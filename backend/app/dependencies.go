package app

import (
	"context"
	"fmt"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/isc-makeit/isc-fes/backend/app/config"
	"github.com/isc-makeit/isc-fes/backend/auth"
	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/media"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	allergens_repository "github.com/isc-makeit/isc-fes/backend/repositories/allergens"
	"github.com/isc-makeit/isc-fes/backend/repositories/imageurl"
	"github.com/isc-makeit/isc-fes/backend/repositories/rooms"
	"github.com/isc-makeit/isc-fes/backend/repositories/stores/carts"
	invRepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/invitations"
	membersRepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/members"
	menuRepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/menus"
	toppings_repository "github.com/isc-makeit/isc-fes/backend/repositories/stores/toppings"
	"github.com/isc-makeit/isc-fes/backend/routers"
	"github.com/isc-makeit/isc-fes/backend/services"
	allergens_service "github.com/isc-makeit/isc-fes/backend/services/allergens"
	rooms_service "github.com/isc-makeit/isc-fes/backend/services/rooms"
	carts_service "github.com/isc-makeit/isc-fes/backend/services/store/carts"
	"github.com/isc-makeit/isc-fes/backend/services/store/invitations"
	"github.com/isc-makeit/isc-fes/backend/services/store/members"
	"github.com/isc-makeit/isc-fes/backend/services/store/menus"
	"github.com/isc-makeit/isc-fes/backend/services/store/toppings"
	"github.com/jackc/pgx/v5/pgxpool"
)

// sessionMiddlewareは、HTTPリクエストへセッションを読み書きする境界。
// AccountとGuestの各Session実装を同じ形で組み込めるようにする。
type sessionMiddleware interface {
	LoadAndSave(next http.Handler) http.Handler
}

type dependencies struct {
	pool               *pgxpool.Pool
	accountSession     sessionMiddleware
	guestSession       sessionMiddleware
	stopSessionCleanup func()
	apiServer          *routers.Server
}

func buildDependencies(
	ctx context.Context,
	cfg config.Config,
) (*dependencies, error) {
	pool, err := pgxpool.New(ctx, cfg.Database.Url)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	accountSession, stopAccountSessionCleanup := auth.NewAccountSession(
		pool,
		cfg.Auth.SessionCookieSecure,
		cfg.Auth.SessionCookieDomain,
	)
	guestSession, stopGuestSessionCleanup := auth.NewGuestSession(
		pool,
		cfg.Auth.SessionCookieSecure,
		cfg.Auth.SessionCookieDomain,
	)
	stopSessionCleanup := func() {
		stopGuestSessionCleanup()
		stopAccountSessionCleanup()
	}

	googleAuthenticator, err := auth.NewGoogleAuthenticator(
		ctx,
		auth.GoogleConfig{
			ClientID:     cfg.Auth.GoogleClientID,
			ClientSecret: cfg.Auth.GoogleClientSecret,
			RedirectURL:  cfg.Auth.GoogleRedirectURL,
		},
	)
	if err != nil {
		stopSessionCleanup()
		pool.Close()
		return nil, fmt.Errorf("initialize Google auth: %w", err)
	}

	s3Client, err := newS3Client(ctx, cfg.S3)
	if err != nil {
		stopSessionCleanup()
		pool.Close()
		return nil, err
	}

	queries := db.New(pool)

	accountRepository := repositories.NewAccountRepository(queries)
	imageRepository := repositories.NewS3Repository(
		s3Client,
		cfg.S3.Bucket,
	)
	var imgGenerator services.ImageURLGenerator
	if cfg.StoreImageBaseURL == "" {
		imgGenerator = imageurl.NewS3ImageURLGenerator(s3Client, cfg.S3.Bucket, cfg.S3.UrlExpiresIn)
	} else {
		imgGenerator, err = imageurl.NewCloudFrontImageURLGenerator(cfg.StoreImageBaseURL)
		if err != nil {
			stopSessionCleanup()
			pool.Close()
			return nil, fmt.Errorf("initialize store image URL generator: %w", err)
		}
	}
	storeRepository := repositories.NewStoreRepository(queries, pool)
	storeMemberRepository := membersRepo.NewStoreMemberRepository(queries)
	storeInvitationRepository := invRepo.NewStoreInvitationRepository(queries, pool)
	menuRepository := menuRepo.NewMenuRepository(queries, pool)
	allergensRepository := allergens_repository.NewAllergenRepository(queries)
	toppingsRepository := toppings_repository.NewToppingsRepository(queries, pool)
	accountService := services.NewAccountService(
		accountRepository,
		accountSession,
	)
	guestRepository := repositories.NewGuestRepository(queries)
	guestResolver := services.NewGuestService(guestSession, guestRepository)
	authService := services.NewAuthService(
		googleAuthenticator,
		accountSession,
		accountRepository,
	)
	storeService := services.NewStoreService(
		media.NewImageProcessor(),
		imageRepository,
		storeRepository,
		allergensRepository,
		accountSession,
		imgGenerator,
	)
	storeMemberService := members.NewStoreMemberService(storeMemberRepository)
	storeInvitationService := invitations.NewStoreInvitationService(storeMemberRepository, storeInvitationRepository)
	errorNotifier := services.NewErrorNotifier(
		cfg.DiscordNotifier.WebhookURL,
		cfg.DiscordNotifier.MentionUserIDs,
	)
	allergenService := allergens_service.NewAllergenService(allergensRepository)
	menuService := menus.NewMenuService(menuRepository, imgGenerator, storeRepository, storeMemberRepository, media.NewImageProcessor(), imageRepository)
	toppingsService := toppings.NewToppingsService(toppingsRepository, storeMemberRepository, storeRepository)
	cartsRepository := carts.NewCartRepository(queries)
	cartService := carts_service.NewCartService(cartsRepository, storeRepository, guestResolver, imgGenerator)
	roomsRepository := rooms.NewRoomsRepository(queries)
	roomsService := rooms_service.NewRoomsService(roomsRepository)

	apiServer := routers.NewServer(
		queries,
		googleAuthenticator,
		cfg.FrontendURL,
		accountService,
		authService,
		guestResolver,
		allergenService,
		storeService,
		storeMemberService,
		storeInvitationService,
		menuService,
		toppingsService,
		cartService,
		roomsService,
		errorNotifier,
	)

	return &dependencies{
		pool:               pool,
		accountSession:     accountSession,
		guestSession:       guestSession,
		stopSessionCleanup: stopSessionCleanup,
		apiServer:          apiServer,
	}, nil
}

func newS3Client(
	ctx context.Context,
	cfg config.S3Config,
) (*s3.Client, error) {
	awsConfig, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.Region),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}

	client := s3.NewFromConfig(awsConfig, func(options *s3.Options) {
		options.UsePathStyle = cfg.UsePathStyle

		if cfg.Endpoint != "" {
			options.BaseEndpoint = aws.String(cfg.Endpoint)
		}
	})

	return client, nil
}
