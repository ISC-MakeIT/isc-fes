package activity_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	menuentity "github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	orderentity "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	allergenrepo "github.com/isc-makeit/isc-fes/backend/repositories/allergens"
	"github.com/isc-makeit/isc-fes/backend/repositories/imageurl"
	"github.com/isc-makeit/isc-fes/backend/repositories/rooms"
	invitationrepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/invitations"
	memberrepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/members"
	"github.com/isc-makeit/isc-fes/backend/routers"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	invitationservice "github.com/isc-makeit/isc-fes/backend/services/store/invitations"
	memberservice "github.com/isc-makeit/isc-fes/backend/services/store/members"
	menuservice "github.com/isc-makeit/isc-fes/backend/services/store/menus"
	toppingservice "github.com/isc-makeit/isc-fes/backend/services/store/toppings"
)

type adminTestSession struct{ accountID uuid.UUID }

func (s adminTestSession) AccountID(context.Context) (uuid.UUID, error) { return s.accountID, nil }
func (s adminTestSession) SignOut(context.Context) error                { return nil }

// 実DBで未所属adminの認可、一般ユーザーの拒否、操作ごとの制約と監査Actorを確認する。
func TestAdminCanManageAllStoresWithoutMembership(t *testing.T) {
	f := newFixture(t, true)
	f.exec(t, `UPDATE accounts SET role='admin' WHERE id=$1`, f.accountID)
	f.exec(t, `DELETE FROM store_members WHERE account_id=$1`, f.accountID)
	ctx := services.WithAuthenticatedAccount(f.ctx, entities.Account{ID: f.accountID, Role: entities.RoleAdmin})
	memberCtx := services.WithAuthenticatedAccount(f.ctx, entities.Account{ID: f.accountID, Role: entities.RoleMember})
	images, err := imageurl.NewCloudFrontImageURLGenerator("https://example.com")
	if err != nil {
		t.Fatal(err)
	}
	members := memberrepo.NewStoreMemberRepository(f.q, f.pool)
	stores := services.NewStoreService(f.stores, members, allergenrepo.NewAllergenRepository(f.q), adminTestSession{f.accountID}, images, rooms.NewRoomsRepository(f.q))
	menus := menuservice.NewMenuService(f.menus, images, f.stores, members, nil)
	toppings := toppingservice.NewToppingsService(f.toppings, members, f.stores)
	memberService := memberservice.NewStoreMemberService(f.stores, members)
	invites := invitationservice.NewStoreInvitationService(f.stores, members, invitationrepo.NewStoreInvitationRepository(f.q, f.pool))
	orders := orderservice.NewOrderService(f.orders, nil, nil, f.stores, members, nil)
	pendingID, rejectedID, otherID := uuid.New(), uuid.New(), uuid.New()
	for id, status := range map[uuid.UUID]string{pendingID: "pending", rejectedID: "rejected", otherID: "approved"} {
		f.exec(t, `INSERT INTO stores (id,name,room,description,image_object_key,review_status,order_enabled) VALUES ($1,'other','activity-room','','image',$2,true)`, id, status)
	}
	for _, memberOnly := range []bool{false, true} {
		got, err := stores.GetVisibleStores(ctx, memberOnly)
		if err != nil || len(got) != 4 {
			t.Fatalf("admin store list (%v) = %+v, %v", memberOnly, got, err)
		}
	}
	// 実際のルーター経由で、公開GETの任意認証とAccountSession認証を確認する。
	accountService := services.NewAccountService(repositories.NewAccountRepository(f.q), adminTestSession{f.accountID})
	server := routers.NewServer(nil, nil, "", accountService, nil, nil, nil, nil, stores, memberService, invites, menus, toppings, nil, nil, nil, orders, nil, nil)
	router, err := routers.NewRouter(server, []string{"https://example.com"})
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{
		"/stores?member_only=true", "/stores/" + pendingID.String(),
		"/stores/" + pendingID.String() + "/menus", "/stores/" + pendingID.String() + "/toppings",
		"/stores/" + f.storeID.String() + "/members", "/stores/" + f.storeID.String() + "/orders",
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK {
			t.Fatalf("admin GET %s = %d: %s", path, response.Code, response.Body.String())
		}
	}
	for _, id := range []uuid.UUID{pendingID, rejectedID} {
		if _, err := stores.GetApprovedStoreByID(ctx, id); err != nil {
			t.Fatal(err)
		}
		if _, err := menus.GetMenusByStoreID(ctx, id); err != nil {
			t.Fatal(err)
		}
		if _, err := toppings.GetToppingsByStoreID(ctx, id); err != nil {
			t.Fatal(err)
		}
		if _, err := stores.GetApprovedStoreByID(memberCtx, id); !errors.Is(err, services.ErrNotFound) {
			t.Fatalf("nonadmin read = %v", err)
		}
		if _, err := menus.CreateMenu(ctx, id, menuservice.CreateMenuInput{}); !errors.Is(err, services.ErrNotFound) {
			t.Fatalf("admin unapproved menu creation = %v", err)
		}
	}
	if _, err := memberService.GetStoreMembersByStoreID(ctx, uuid.New()); !errors.Is(err, services.ErrNotFound) {
		t.Fatalf("missing store members = %v", err)
	}
	if _, err := invites.CreateStoreInvitation(ctx, uuid.New(), entities.StoreMemberRoleStaff, nil); !errors.Is(err, services.ErrNotFound) {
		t.Fatalf("missing store invitation = %v", err)
	}

	for _, storeID := range []uuid.UUID{f.storeID, otherID} {
		if _, err := stores.UpdateStore(memberCtx, storeID, services.UpdateStoreInput{}); !errors.Is(err, services.ErrForbidden) {
			t.Fatalf("nonmember update = %v", err)
		}
		closed := true
		if _, err := stores.UpdateStore(ctx, storeID, services.UpdateStoreInput{Closed: &closed}); err != nil {
			t.Fatal(err)
		}
		closed = false
		if _, err := stores.UpdateStore(ctx, storeID, services.UpdateStoreInput{Closed: &closed}); err != nil {
			t.Fatal(err)
		}
		if _, err := menus.CreateMenu(ctx, storeID, menuservice.CreateMenuInput{ImageObjectKey: "invalid"}); !errors.Is(err, services.ErrInvalidInput) {
			t.Fatalf("admin invalid menu image = %v", err)
		}
		menu, err := menus.CreateMenu(ctx, storeID, menuservice.CreateMenuInput{Name: "menu", UnitPrice: 500, ImageObjectKey: menuentity.NewMenuImageObjectKey(uuid.New())})
		if err != nil {
			t.Fatal(err)
		}
		soldOut := true
		if _, err := menus.UpdateMenuByStoreIDAndMenuID(ctx, storeID, menu.ID, menuservice.UpdateMenuInput{SoldOut: &soldOut}); err != nil {
			t.Fatal(err)
		}
		if _, err := menus.GetMenusByStoreID(ctx, storeID); err != nil {
			t.Fatal(err)
		}
		if err := menus.DeleteMenuByStoreIDAndMenuID(ctx, storeID, menu.ID); err != nil {
			t.Fatal(err)
		}
		topping, err := toppings.CreateTopping(ctx, toppingservice.CreateToppingInput{StoreID: storeID, Name: "cheese", UnitPrice: 100})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := toppings.UpdateToppingByStoreIDAndToppingID(ctx, storeID, topping.ID, toppingservice.UpdateToppingInput{SoldOut: &soldOut}); err != nil {
			t.Fatal(err)
		}
		if _, err := toppings.GetToppingsByStoreID(ctx, storeID); err != nil {
			t.Fatal(err)
		}
		if err := toppings.DeleteTopping(ctx, storeID, topping.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := orders.GetOrdersByStoreID(ctx, storeID, nil); err != nil {
			t.Fatal(err)
		}
		if _, err := orders.GetOrdersByStoreID(memberCtx, storeID, nil); !errors.Is(err, services.ErrForbidden) {
			t.Fatalf("nonmember orders = %v", err)
		}
		if _, err := invites.CreateStoreInvitation(ctx, storeID, entities.StoreMemberRoleStaff, nil); err != nil {
			t.Fatal(err)
		}
		for _, role := range []entities.StoreMemberRole{entities.StoreMemberRoleManager, entities.StoreMemberRoleStaff} {
			id := uuid.New()
			f.exec(t, `INSERT INTO accounts (id,google_sub,email) VALUES ($1,$2::text,$2::text)`, id, id.String())
			f.exec(t, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,$3)`, storeID, id, role)
			if _, err := memberService.GetStoreMemberByAccountIDAndStoreID(ctx, id, storeID); err != nil {
				t.Fatal(err)
			}
			err := memberService.RemoveStoreMemberByAccountIDAndStoreID(ctx, id, storeID)
			if role == entities.StoreMemberRoleManager && !errors.Is(err, services.ErrForbidden) {
				t.Fatalf("admin deleted manager: %v", err)
			}
			if role == entities.StoreMemberRoleStaff && err != nil {
				t.Fatal(err)
			}
		}
		if got, err := memberService.GetStoreMembersByStoreID(ctx, storeID); err != nil || len(got) != 1 {
			t.Fatalf("members = %+v, %v", got, err)
		}
	}
	if got := f.count(t, `SELECT count(*) FROM store_members WHERE account_id=$1`, f.accountID); got != 0 {
		t.Fatalf("admin membership persisted: %d", got)
	}
	if got := f.count(t, `SELECT count(*) FROM activity_log WHERE actor_account_id IS DISTINCT FROM $1`, f.accountID); got != 0 {
		t.Fatalf("incorrect audit actors: %d", got)
	}
	if _, err := memberService.GetStoreMemberByAccountIDAndStoreID(ctx, f.accountID, f.storeID); !errors.Is(err, services.ErrNotFound) {
		t.Fatalf("admin without actual membership = %v", err)
	}
	// SQLの通常ユーザー向け一覧フィルタも維持する。
	f.exec(t, `UPDATE accounts SET role='member' WHERE id=$1`, f.accountID)
	if got, err := stores.GetVisibleStores(memberCtx, true); err != nil || len(got) != 0 {
		t.Fatalf("nonmember stores = %+v, %v", got, err)
	}
	if got, err := stores.GetVisibleStores(memberCtx, false); err != nil || len(got) != 2 {
		t.Fatalf("public stores = %+v, %v", got, err)
	}
	f.exec(t, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,'staff')`, pendingID, f.accountID)
	if got, err := stores.GetVisibleStores(memberCtx, false); err != nil || len(got) != 2 {
		t.Fatalf("staff public stores = %+v, %v", got, err)
	}
	if got, err := stores.GetVisibleStores(memberCtx, true); err != nil || len(got) != 1 || got[0].ID != pendingID {
		t.Fatalf("staff member stores = %+v, %v", got, err)
	}
	f.exec(t, `UPDATE store_members SET role='manager' WHERE account_id=$1`, f.accountID)
	if got, err := stores.GetVisibleStores(memberCtx, false); err != nil || len(got) != 3 {
		t.Fatalf("manager visible stores = %+v, %v", got, err)
	}

}

func TestAdminOrderLimitExemptionWithoutMembership(t *testing.T) {
	f := newFixture(t, true)
	f.exec(t, `UPDATE accounts SET role='admin' WHERE id=$1`, f.accountID)
	f.exec(t, `DELETE FROM store_members WHERE account_id=$1`, f.accountID)
	input := f.seedCart(t)
	var menuID, cartID uuid.UUID
	if err := f.pool.QueryRow(f.ctx, `SELECT c.id,i.menu_id FROM carts c JOIN cart_items i ON i.cart_id=c.id WHERE c.guest_id=$1`, input.GuestID).Scan(&cartID, &menuID); err != nil {
		t.Fatal(err)
	}
	for i := range 3 {
		if i > 0 {
			f.exec(t, `INSERT INTO cart_items (cart_id,menu_id,store_id,quantity) VALUES ($1,$2,$3,1)`, cartID, menuID, f.storeID)
			if err := f.pool.QueryRow(f.ctx, `SELECT version FROM carts WHERE id=$1`, cartID).Scan(&input.ExpectedCartVersion); err != nil {
				t.Fatal(err)
			}
		}
		input.AccountID = nil
		if i == 2 {
			if _, err := f.orders.CreateOrder(f.ctx, input); !errors.Is(err, orderservice.ErrOrderLimitReached) {
				t.Fatalf("guest exceeded limit: %v", err)
			}
			if err := f.orders.CheckCheckout(f.ctx, input); !errors.Is(err, orderservice.ErrOrderLimitReached) {
				t.Fatalf("guest checkout exceeded limit: %v", err)
			}
			input.AccountID = &f.accountID
			if err := f.orders.CheckCheckout(f.ctx, input); err != nil {
				t.Fatalf("admin checkout exemption: %v", err)
			}
		}
		result, err := f.orders.CreateOrder(f.ctx, input)
		if err != nil {
			t.Fatal(err)
		}
		if i == 2 && (result.Order.LimitExemptedByAccountID == nil || *result.Order.LimitExemptedByAccountID != f.accountID || result.Order.Status != orderentity.OrderStatusPending) {
			t.Fatalf("admin exemption = %+v", result.Order)
		}
	}
}
