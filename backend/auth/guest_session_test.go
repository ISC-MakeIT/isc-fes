package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
)

func TestGuestSessionPersistsGuestID(t *testing.T) {
	session, ctx := newTestGuestSession(t)
	want := uuid.New()

	if err := session.BindGuest(ctx, want); err != nil {
		t.Fatalf("BindGuest() error = %v", err)
	}

	ctx = commitAndReloadGuestSession(t, session, ctx)

	got, found, err := session.GuestID(ctx)
	if err != nil {
		t.Fatalf("GuestID() error = %v", err)
	}
	if !found {
		t.Fatal("GuestID() found = false, want true")
	}
	if got != want {
		t.Errorf("GuestID() = %v, want %v", got, want)
	}
}

func TestGuestIDWithoutBinding(t *testing.T) {
	session, ctx := newTestGuestSession(t)

	got, found, err := session.GuestID(ctx)
	if err != nil {
		t.Fatalf("GuestID() error = %v", err)
	}
	if found {
		t.Errorf("GuestID() found = true, want false")
	}
	if got != uuid.Nil {
		t.Errorf("GuestID() = %v, want uuid.Nil", got)
	}
}

func TestGuestIDRejectsInvalidStoredValue(t *testing.T) {
	session, ctx := newTestGuestSession(t)
	session.manager.Put(ctx, guestIDKey, "invalid")

	_, found, err := session.GuestID(ctx)
	if !errors.Is(err, ErrInvalidGuestSession) {
		t.Fatalf("GuestID() error = %v, want %v", err, ErrInvalidGuestSession)
	}
	if found {
		t.Error("GuestID() found = true, want false")
	}
}

func TestGuestSessionDestroysInvalidSessionAndContinuesRequest(t *testing.T) {
	session, ctx := newTestGuestSession(t)
	session.manager.Put(ctx, guestIDKey, "invalid")

	token, _, err := session.manager.Commit(ctx)
	if err != nil {
		t.Fatalf("Commit() error = %v", err)
	}

	handlerCalled := false
	handler := session.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.AddCookie(&http.Cookie{
		Name:  "isc_fes_guest_session",
		Value: token,
	})
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	if !handlerCalled {
		t.Error("handler was not called")
	}

	var expired bool
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == "isc_fes_guest_session" && cookie.Value == "" && cookie.MaxAge < 0 {
			expired = true
			break
		}
	}
	if !expired {
		t.Error("invalid guest session cookie was not expired")
	}

	reloadedCtx, err := session.manager.Load(context.Background(), token)
	if err != nil {
		t.Fatalf("Load() destroyed session error = %v", err)
	}
	_, found, err := session.GuestID(reloadedCtx)
	if err != nil {
		t.Fatalf("GuestID() destroyed session error = %v", err)
	}
	if found {
		t.Error("GuestID() destroyed session found = true, want false")
	}
}

func TestBindGuestRejectsNilID(t *testing.T) {
	session, ctx := newTestGuestSession(t)

	err := session.BindGuest(ctx, uuid.Nil)
	if !errors.Is(err, ErrInvalidGuestSession) {
		t.Fatalf("BindGuest() error = %v, want %v", err, ErrInvalidGuestSession)
	}
}

func TestBindGuestDoesNotReplaceExistingGuest(t *testing.T) {
	session, ctx := newTestGuestSession(t)
	firstGuestID := uuid.New()
	if err := session.BindGuest(ctx, firstGuestID); err != nil {
		t.Fatalf("first BindGuest() error = %v", err)
	}

	err := session.BindGuest(ctx, uuid.New())
	if !errors.Is(err, ErrGuestSessionAlreadyBound) {
		t.Fatalf("second BindGuest() error = %v, want %v", err, ErrGuestSessionAlreadyBound)
	}

	got, found, err := session.GuestID(ctx)
	if err != nil {
		t.Fatalf("GuestID() error = %v", err)
	}
	if !found || got != firstGuestID {
		t.Errorf("GuestID() = (%v, %v), want (%v, true)", got, found, firstGuestID)
	}
}

func TestConfigureGuestSessionCookie(t *testing.T) {
	manager := scs.New()
	configureSessionCookie(manager, "isc_fes_guest_session", true, "fes.iwasaki.ac.jp")

	if manager.Cookie.Name != "isc_fes_guest_session" {
		t.Errorf("Cookie.Name = %q, want %q", manager.Cookie.Name, "isc_fes_guest_session")
	}
	if manager.Cookie.Domain != "fes.iwasaki.ac.jp" {
		t.Errorf("Cookie.Domain = %q, want %q", manager.Cookie.Domain, "fes.iwasaki.ac.jp")
	}
	if manager.Cookie.Path != "/" {
		t.Errorf("Cookie.Path = %q, want %q", manager.Cookie.Path, "/")
	}
	if !manager.Cookie.HttpOnly {
		t.Error("Cookie.HttpOnly = false, want true")
	}
	if !manager.Cookie.Secure {
		t.Error("Cookie.Secure = false, want true")
	}
	if manager.Cookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("Cookie.SameSite = %v, want %v", manager.Cookie.SameSite, http.SameSiteLaxMode)
	}
	if !manager.Cookie.Persist {
		t.Error("Cookie.Persist = false, want true")
	}
}

func TestGuestSessionRenewsNearExpiry(t *testing.T) {
	session, ctx := newTestGuestSession(t)
	if err := session.BindGuest(ctx, uuid.New()); err != nil {
		t.Fatalf("BindGuest() error = %v", err)
	}

	oldToken, _, err := session.manager.Commit(ctx)
	if err != nil {
		t.Fatalf("initial Commit() error = %v", err)
	}

	ctx, err = session.manager.Load(context.Background(), oldToken)
	if err != nil {
		t.Fatalf("initial Load() error = %v", err)
	}
	session.manager.SetDeadline(ctx, time.Now().Add(guestSessionRenewBefore-time.Hour))
	if _, _, err := session.manager.Commit(ctx); err != nil {
		t.Fatalf("near-expiry Commit() error = %v", err)
	}

	ctx, err = session.manager.Load(context.Background(), oldToken)
	if err != nil {
		t.Fatalf("near-expiry Load() error = %v", err)
	}
	if err := session.RenewIfNeeded(ctx); err != nil {
		t.Fatalf("RenewIfNeeded() error = %v", err)
	}

	newToken, expiry, err := session.manager.Commit(ctx)
	if err != nil {
		t.Fatalf("renewed Commit() error = %v", err)
	}
	if newToken == oldToken {
		t.Error("RenewIfNeeded() did not rotate the session token")
	}
	if time.Until(expiry) < guestSessionLifetime-time.Minute {
		t.Errorf("renewed lifetime = %v, want about %v", time.Until(expiry), guestSessionLifetime)
	}
}

func TestGuestSessionWithoutGuestDoesNotSetCookie(t *testing.T) {
	session := newGuestSessionWithManager(scs.New())
	handler := session.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if cookies := recorder.Result().Cookies(); len(cookies) != 0 {
		t.Errorf("response cookies = %v, want none", cookies)
	}
}

func TestAccountAndGuestSessionsSetIndependentCookies(t *testing.T) {
	accountManager := scs.New()
	configureAccountSessionCookie(accountManager, true, "")
	accountSession := &AccountSession{manager: accountManager}
	guestSession := newGuestSessionWithManager(scs.New())

	handler := accountSession.LoadAndSave(
		guestSession.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := accountSession.SignIn(r.Context(), uuid.New()); err != nil {
				t.Errorf("SignIn() error = %v", err)
				return
			}
			if err := guestSession.BindGuest(r.Context(), uuid.New()); err != nil {
				t.Errorf("BindGuest() error = %v", err)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		})),
	)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	cookieNames := make(map[string]bool)
	for _, cookie := range recorder.Result().Cookies() {
		cookieNames[cookie.Name] = true
	}

	if !cookieNames["isc_fes_account_session"] {
		t.Error("account session cookie was not set")
	}
	if !cookieNames["isc_fes_guest_session"] {
		t.Error("guest session cookie was not set")
	}
}

func newTestGuestSession(t *testing.T) (*GuestSession, context.Context) {
	t.Helper()

	manager := scs.New()
	manager.HashTokenInStore = true
	session := newGuestSessionWithManager(manager)

	ctx, err := manager.Load(context.Background(), "")
	if err != nil {
		t.Fatalf("load test session: %v", err)
	}

	return session, ctx
}

func newGuestSessionWithManager(manager *scs.SessionManager) *GuestSession {
	manager.HashTokenInStore = true
	manager.Lifetime = guestSessionLifetime
	configureSessionCookie(manager, "isc_fes_guest_session", true, "")
	return &GuestSession{manager: manager}
}

func commitAndReloadGuestSession(
	t *testing.T,
	session *GuestSession,
	ctx context.Context,
) context.Context {
	t.Helper()

	token, _, err := session.manager.Commit(ctx)
	if err != nil {
		t.Fatalf("commit test guest session: %v", err)
	}

	nextCtx, err := session.manager.Load(context.Background(), token)
	if err != nil {
		t.Fatalf("reload test guest session: %v", err)
	}

	return nextCtx
}
