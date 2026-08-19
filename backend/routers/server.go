package routers

import (
	"github.com/isc-makeit/isc-fes/backend/auth"
	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/services/allergens"
	"github.com/isc-makeit/isc-fes/backend/services/store/invitations"
	"github.com/isc-makeit/isc-fes/backend/services/store/members"
	"github.com/isc-makeit/isc-fes/backend/services/store/menus"
)

type Server struct {
	queries             *db.Queries
	sessions            *auth.Sessions
	googleAuthenticator *auth.GoogleAuthenticator
	frontendURL         string
	accountService      *services.AccountService
	auth                *services.AuthService
	allergen            *allergens.AllergenService
	store               *services.StoreService
	storeMember         *members.StoreMemberService
	storeInvitation     *invitations.StoreInvitationService
	menu                *menus.MenuService
	errorNotifier       *services.ErrorNotifier
}

func NewServer(
	queries *db.Queries,
	sessions *auth.Sessions,
	googleAuthenticator *auth.GoogleAuthenticator,
	frontendURL string,
	accountService *services.AccountService,
	authService *services.AuthService,
	allergenService *allergens.AllergenService,
	storeService *services.StoreService,
	storeMemberService *members.StoreMemberService,
	storeInvitationService *invitations.StoreInvitationService,
	menuService *menus.MenuService,
	errorNotifier *services.ErrorNotifier,
) *Server {
	return &Server{
		queries:             queries,
		sessions:            sessions,
		googleAuthenticator: googleAuthenticator,
		frontendURL:         frontendURL,
		accountService:      accountService,
		auth:                authService,
		allergen:            allergenService,
		store:               storeService,
		storeMember:         storeMemberService,
		storeInvitation:     storeInvitationService,
		menu:                menuService,
		errorNotifier:       errorNotifier,
	}
}
