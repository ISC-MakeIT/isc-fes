package routers

import (
	"github.com/isc-makeit/isc-fes/backend/auth"
	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/services/store/invitations"
	"github.com/isc-makeit/isc-fes/backend/services/store/members"
)

type Server struct {
	queries             *db.Queries
	sessions            *auth.Sessions
	googleAuthenticator *auth.GoogleAuthenticator
	frontendURL         string
	accountService      *services.AccountService
	auth                *services.AuthService
	store               *services.StoreService
	storeMember         *members.StoreMemberService
	storeInvitation     *invitations.StoreInvitationService
	errorNotifier       *services.ErrorNotifier
}

func NewServer(
	queries *db.Queries,
	sessions *auth.Sessions,
	googleAuthenticator *auth.GoogleAuthenticator,
	frontendURL string,
	accountService *services.AccountService,
	authService *services.AuthService,
	storeService *services.StoreService,
	storeMemberService *members.StoreMemberService,
	storeInvitationService *invitations.StoreInvitationService,
	errorNotifier *services.ErrorNotifier,
) *Server {
	return &Server{
		queries:             queries,
		sessions:            sessions,
		googleAuthenticator: googleAuthenticator,
		frontendURL:         frontendURL,
		accountService:      accountService,
		auth:                authService,
		store:               storeService,
		storeMember:         storeMemberService,
		storeInvitation:     storeInvitationService,
		errorNotifier:       errorNotifier,
	}
}
