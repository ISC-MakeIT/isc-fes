package repository

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
)

type S3Repository struct {
	client       *s3.Client
	bucket       string
	urlExpiresIn time.Duration
}

// TODO: S3 クライアントを必要最小限のインターフェースとして注入し、Put/Delete の入力とエラー処理を単体テストする。
func NewS3Repository(client *s3.Client, bucket string, urlExpiresIn time.Duration) *S3Repository {
	return &S3Repository{
		client:       client,
		bucket:       bucket,
		urlExpiresIn: urlExpiresIn,
	}
}

func (r *S3Repository) PutObject(ctx context.Context, reader io.ReadSeeker, objectKey entities.StoreImageObjectKey, contentType string) error {
	_, err := r.client.PutObject(
		ctx,
		&s3.PutObjectInput{
			Bucket:      aws.String(r.bucket),
			Key:         aws.String(objectKey.String()),
			Body:        reader,
			ContentType: aws.String(contentType),
		},
	)
	if err != nil {
		// TODO: DeleteObject と同様に、操作名とオブジェクトキーを付けて S3 エラーを wrap する。
		return err
	}

	return nil
}

func (r *S3Repository) DeleteObject(ctx context.Context, objectKey entities.StoreImageObjectKey) error {
	_, err := r.client.DeleteObject(
		ctx,
		&s3.DeleteObjectInput{
			Bucket: aws.String(r.bucket),
			Key:    aws.String(objectKey.String()),
		},
	)
	if err != nil {
		return fmt.Errorf(
			"delete S3 object %q: %w",
			objectKey,
			err,
		)
	}

	return nil
}

func (r *S3Repository) GetPublicURL(ctx context.Context, objectKey entities.StoreImageObjectKey) (string, error) {
	presignClient := s3.NewPresignClient(r.client)

	presignedReq, err := presignClient.PresignGetObject(
		ctx,
		&s3.GetObjectInput{
			Bucket: aws.String(r.bucket),
			Key:    aws.String(objectKey.String()),
		},
		s3.WithPresignExpires(r.urlExpiresIn),
	)
	if err != nil {
		return "", fmt.Errorf(
			"presign S3 object %q: %w",
			objectKey,
			err,
		)
	}

	return presignedReq.URL, nil
}

var _ service.StoreImageRepository = (*S3Repository)(nil)
