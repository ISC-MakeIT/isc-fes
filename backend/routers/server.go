package routers

import (
	"github.com/isc-makeit/isc-fes/backend/auth"
	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/services/allergens"
	"github.com/isc-makeit/isc-fes/backend/services/rooms"
	"github.com/isc-makeit/isc-fes/backend/services/store/carts"
	"github.com/isc-makeit/isc-fes/backend/services/store/invitations"
	"github.com/isc-makeit/isc-fes/backend/services/store/members"
	"github.com/isc-makeit/isc-fes/backend/services/store/menus"
	"github.com/isc-makeit/isc-fes/backend/services/store/toppings"
)

type Server struct {
	queries             *db.Queries
	googleAuthenticator *auth.GoogleAuthenticator
	frontendURL         string
	accountService      *services.AccountService
	auth                *services.AuthService
	guestResolver       guestResolver
	allergen            *allergens.AllergenService
	store               *services.StoreService
	storeMember         *members.StoreMemberService
	storeInvitation     *invitations.StoreInvitationService
	menu                *menus.MenuService
	toppings            *toppings.ToppingsService
	cart                *carts.CartService
	rooms               *rooms.RoomsService
	errorNotifier       *services.ErrorNotifier
}

func NewServer(
	queries *db.Queries,
	googleAuthenticator *auth.GoogleAuthenticator,
	frontendURL string,
	accountService *services.AccountService,
	authService *services.AuthService,
	guestResolver guestResolver,
	allergenService *allergens.AllergenService,
	storeService *services.StoreService,
	storeMemberService *members.StoreMemberService,
	storeInvitationService *invitations.StoreInvitationService,
	menuService *menus.MenuService,
	toppingsService *toppings.ToppingsService,
	cartService *carts.CartService,
	roomsService *rooms.RoomsService,
	errorNotifier *services.ErrorNotifier,
) *Server {
	return &Server{
		queries:             queries,
		googleAuthenticator: googleAuthenticator,
		frontendURL:         frontendURL,
		accountService:      accountService,
		auth:                authService,
		guestResolver:       guestResolver,
		allergen:            allergenService,
		store:               storeService,
		storeMember:         storeMemberService,
		storeInvitation:     storeInvitationService,
		menu:                menuService,
		toppings:            toppingsService,
		cart:                cartService,
		rooms:               roomsService,
		errorNotifier:       errorNotifier,
	}
}
