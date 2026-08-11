package api

import (
	"github.com/isc-makeit/isc-fes/backend/internal/auth"
	db "github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
)

type Server struct {
	queries                     *db.Queries
	sessions                    *auth.Sessions
	googleAuthenticator         *auth.GoogleAuthenticator
	frontendURL                 string
	accountService              *service.AccountService
	auth                        *service.AuthService
	store                       *service.StoreService
	storeMembershipApplications *service.StoreMembershipApplicationsService
	errorNotifier               *service.ErrorNotifier
}

func NewServer(
	queries *db.Queries,
	sessions *auth.Sessions,
	googleAuthenticator *auth.GoogleAuthenticator,
	frontendURL string,
	accountService *service.AccountService,
	authService *service.AuthService,
	storeService *service.StoreService,
	storeMembershipApplicationsService *service.StoreMembershipApplicationsService,
	errorNotifier *service.ErrorNotifier,
) *Server {
	return &Server{
		queries:                     queries,
		sessions:                    sessions,
		googleAuthenticator:         googleAuthenticator,
		frontendURL:                 frontendURL,
		accountService:              accountService,
		auth:                        authService,
		store:                       storeService,
		storeMembershipApplications: storeMembershipApplicationsService,
		errorNotifier:               errorNotifier,
	}
}
