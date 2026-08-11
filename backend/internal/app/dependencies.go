package app

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/isc-makeit/isc-fes/backend/internal/api"
	"github.com/isc-makeit/isc-fes/backend/internal/auth"
	"github.com/isc-makeit/isc-fes/backend/internal/config"
	db "github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/internal/media"
	"github.com/isc-makeit/isc-fes/backend/internal/repository"
	"github.com/isc-makeit/isc-fes/backend/internal/repository/imageurl"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

type dependencies struct {
	pool               *pgxpool.Pool
	sessions           *auth.Sessions
	stopSessionCleanup func()
	apiServer          *api.Server
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

	accountRepository := repository.NewAccountRepository(queries)
	imageRepository := repository.NewS3Repository(
		s3Client,
		cfg.S3.Bucket,
	)
	var imgGenerator service.ImageURLGenerator
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
	storeRepository := repository.NewStoreRepository(queries, pool)
	storeMembershipApplicationsRepository := repository.NewStoreMembershipApplicationsRepository(
		queries,
	)

	accountService := service.NewAccountService(
		accountRepository,
		sessions,
	)
	authService := service.NewAuthService(
		googleAuthenticator,
		sessions,
		accountRepository,
	)
	storeService := service.NewStoreService(
		media.NewImageProcessor(),
		imageRepository,
		storeRepository,
		sessions,
		accountRepository,
		imgGenerator,
	)
	storeMembershipApplicationsService := service.NewStoreMembershipApplicationsService(
		storeRepository,
		storeMembershipApplicationsRepository,
		accountRepository,
		sessions,
	)
	errorNotifier := service.NewErrorNotifier(
		cfg.DiscordNotifier.WebhookURL,
		cfg.DiscordNotifier.MentionUserIDs,
	)

	apiServer := api.NewServer(
		queries,
		sessions,
		googleAuthenticator,
		cfg.FrontendURL,
		accountService,
		authService,
		storeService,
		storeMembershipApplicationsService,
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
