package app

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/isc-makeit/isc-fes/backend/auth"
	"github.com/isc-makeit/isc-fes/backend/config"
	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/media"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	allergens_repository "github.com/isc-makeit/isc-fes/backend/repositories/allergens"
	"github.com/isc-makeit/isc-fes/backend/repositories/imageurl"
	invRepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/invitations"
	membersRepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/members"
	menuRepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/menus"
	toppings_repository "github.com/isc-makeit/isc-fes/backend/repositories/stores/toppings"
	"github.com/isc-makeit/isc-fes/backend/routers"
	"github.com/isc-makeit/isc-fes/backend/services"
	allergens_service "github.com/isc-makeit/isc-fes/backend/services/allergens"
	"github.com/isc-makeit/isc-fes/backend/services/store/invitations"
	"github.com/isc-makeit/isc-fes/backend/services/store/members"
	"github.com/isc-makeit/isc-fes/backend/services/store/menus"
	"github.com/isc-makeit/isc-fes/backend/services/store/toppings"
	"github.com/jackc/pgx/v5/pgxpool"
)

type dependencies struct {
	pool               *pgxpool.Pool
	sessions           *auth.Sessions
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

	sessions, stopSessionCleanup := auth.NewSessions(
		pool,
		cfg.Auth.SessionCookieSecure,
		cfg.Auth.SessionCookieDomain,
	)

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
	toppingsRepository := toppings_repository.NewToppingsRepository(queries)
	accountService := services.NewAccountService(
		accountRepository,
		sessions,
	)
	authService := services.NewAuthService(
		googleAuthenticator,
		sessions,
		accountRepository,
	)
	storeService := services.NewStoreService(
		media.NewImageProcessor(),
		imageRepository,
		storeRepository,
		allergensRepository,
		sessions,
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

	apiServer := routers.NewServer(
		queries,
		sessions,
		googleAuthenticator,
		cfg.FrontendURL,
		accountService,
		authService,
		allergenService,
		storeService,
		storeMemberService,
		storeInvitationService,
		menuService,
		toppingsService,
		errorNotifier,
	)

	return &dependencies{
		pool:               pool,
		sessions:           sessions,
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
