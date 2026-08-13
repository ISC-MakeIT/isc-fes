package imageurl

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/isc-makeit/isc-fes/backend/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/service"
)

// ローカルの S3 画像URL 生成器。S3 の Presigned URL を生成する。
// 本番では CloudFront を挟むので、この実装は使われない
type S3ImageURLGenerator struct {
	client       *s3.Client
	bucket       string
	urlExpiresIn time.Duration
}

func NewS3ImageURLGenerator(client *s3.Client, bucket string, urlExpiresIn time.Duration) *S3ImageURLGenerator {
	return &S3ImageURLGenerator{
		client:       client,
		bucket:       bucket,
		urlExpiresIn: urlExpiresIn,
	}
}

func (r *S3ImageURLGenerator) GenerateStoreImageURL(ctx context.Context, objectKey entities.StoreImageObjectKey) (string, error) {
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

var _ service.ImageURLGenerator = (*S3ImageURLGenerator)(nil)
