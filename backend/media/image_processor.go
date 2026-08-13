package media

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	stddraw "image/draw"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"

	"github.com/isc-makeit/isc-fes/backend/services"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// 店舗画像の入力、処理負荷、出力品質に関する制限値。
// デコード後の画像はファイルサイズより大きくなるため、バイト数と画素数をそれぞれ制限する。
const (
	maxStoreImageInputBytes        = 10 << 20 // 入力ファイルは最大10 MiB
	maxStoreImageWidth             = 6000
	maxStoreImageHeight            = 6000
	maxStoreImagePixels      int64 = 13_000_000
	maxStoreImageLongEdge          = 1600
	maxStoreImageOutputBytes       = 3 << 20 // 処理後のファイルは最大3 MiB
	storeImageJPEGQuality          = 82
	storeImageContentType          = "image/jpeg"
	storeImageConcurrency          = 1
)

// ImageProcessorは、店舗画像を検証し、配信用のJPEGへ変換する。
// 大きな画像によるメモリ枯渇を防ぐため、同時に処理する画像数を制限する。
type ImageProcessor struct {
	slots chan struct{}
}

// NewImageProcessorは、店舗画像用の制限値を設定したImageProcessorを生成する。
func NewImageProcessor() *ImageProcessor {
	return &ImageProcessor{
		slots: make(chan struct{}, storeImageConcurrency),
	}
}

// ProcessForStoreImageは、アップロードされた画像を検証し、長辺を縮小したJPEGを返す。
// JPEGに含まれるEXIFの画像方向情報は画素へ反映し、位置情報などのメタデータは再エンコードによって除去する。
func (p *ImageProcessor) ProcessForStoreImage(
	ctx context.Context,
	reader io.ReadSeeker,
) (io.ReadSeeker, string, error) {
	if err := p.acquire(ctx); err != nil {
		return nil, "", err
	}
	defer p.release()

	if err := validateStoreImageInputSize(reader); err != nil {
		return nil, "", err
	}

	config, format, err := decodeStoreImageConfig(reader)
	if err != nil {
		return nil, "", err
	}
	if err := validateStoreImageConfig(config, format); err != nil {
		return nil, "", err
	}
	orientation := extractStoreImageOrientation(reader, format)

	if err := ctx.Err(); err != nil {
		return nil, "", fmt.Errorf("process store image: %w", err)
	}

	decoded, err := decodeStoreImage(reader, format)
	if err != nil {
		return nil, "", err
	}
	if err := validateDecodedStoreImage(decoded, config); err != nil {
		return nil, "", err
	}
	if err := ctx.Err(); err != nil {
		return nil, "", fmt.Errorf("process store image: %w", err)
	}

	resized := resizeStoreImage(decoded)
	oriented := applyStoreImageOrientation(resized, orientation)
	flattened := flattenStoreImageOnWhite(oriented)
	if err := ctx.Err(); err != nil {
		return nil, "", fmt.Errorf("process store image: %w", err)
	}

	encoded, err := encodeStoreImageJPEG(flattened)
	if err != nil {
		return nil, "", err
	}

	return bytes.NewReader(encoded), storeImageContentType, nil
}

// acquireは、画像処理の実行枠が空くまで待機する。
// 待機中にリクエストがキャンセルされた場合は、画像を処理せず終了する。
func (p *ImageProcessor) acquire(ctx context.Context) error {
	select {
	case p.slots <- struct{}{}:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("wait for store image processor: %w", ctx.Err())
	}
}

// releaseは、確保していた画像処理の実行枠を解放する。
func (p *ImageProcessor) release() {
	<-p.slots
}

// validateStoreImageInputSizeは、画像全体をデコードする前に実際の入力バイト数を検証する。
// API層でも上限を設けているが、HTTP以外から呼ばれた場合に備えてProcessorでも検証する。
func validateStoreImageInputSize(reader io.ReadSeeker) error {
	size, err := reader.Seek(0, io.SeekEnd)
	if err != nil {
		return fmt.Errorf("seek store image end: %w", err)
	}

	if err := resetImageReader(reader); err != nil {
		return err
	}

	switch {
	case size == 0:
		return services.ErrEmptyImage
	case size > maxStoreImageInputBytes:
		return fmt.Errorf(
			"%w: got %d bytes, max %d bytes",
			services.ErrImageTooLarge,
			size,
			maxStoreImageInputBytes,
		)
	default:
		return nil
	}
}

// decodeStoreImageConfigは、画像全体をメモリへ展開せずに形式と寸法を取得する。
// ここで得た寸法を先に検証することで、巨大画像によるメモリ枯渇を防ぐ。
func decodeStoreImageConfig(reader io.ReadSeeker) (image.Config, string, error) {
	if err := resetImageReader(reader); err != nil {
		return image.Config{}, "", err
	}

	config, format, err := image.DecodeConfig(reader)
	if err != nil {
		return image.Config{}, "", fmt.Errorf(
			"%w: decode store image config: %v",
			services.ErrInvalidImage,
			err,
		)
	}

	return config, format, nil
}

// validateStoreImageConfigは、入力形式、幅、高さ、総画素数が許容範囲内か検証する。
func validateStoreImageConfig(config image.Config, format string) error {
	switch format {
	case "jpeg", "png", "webp":
	default:
		return fmt.Errorf(
			"%w: %q",
			services.ErrUnsupportedImageFormat,
			format,
		)
	}

	if config.Width <= 0 || config.Height <= 0 {
		return services.ErrInvalidImage
	}

	if config.Width > maxStoreImageWidth || config.Height > maxStoreImageHeight {
		return fmt.Errorf(
			"%w: got %dx%d, max %dx%d",
			services.ErrImageDimensionsExceeded,
			config.Width,
			config.Height,
			maxStoreImageWidth,
			maxStoreImageHeight,
		)
	}

	// 幅と高さの乗算による整数オーバーフローを避けるため、除算して比較する。
	if int64(config.Width) > maxStoreImagePixels/int64(config.Height) {
		return fmt.Errorf(
			"%w: got %dx%d, max %d pixels",
			services.ErrImageDimensionsExceeded,
			config.Width,
			config.Height,
			maxStoreImagePixels,
		)
	}

	return nil
}

// decodeStoreImageは、画像全体をデコードして、ヘッダーだけでは分からない破損を検出する。
// 事前検証時と完全デコード時の形式が一致することも確認する。
func decodeStoreImage(reader io.ReadSeeker, expectedFormat string) (image.Image, error) {
	if err := resetImageReader(reader); err != nil {
		return nil, err
	}

	decoded, format, err := image.Decode(reader)
	if err != nil {
		return nil, fmt.Errorf(
			"%w: decode store image: %v",
			services.ErrInvalidImage,
			err,
		)
	}
	if format != expectedFormat {
		return nil, fmt.Errorf(
			"%w: config format %q differs from decoded format %q",
			services.ErrInvalidImage,
			expectedFormat,
			format,
		)
	}

	return decoded, nil
}

// validateDecodedStoreImageは、完全デコード後の寸法を再検証する。
// 事前に取得した寸法と実際の画素領域が異なる画像は、不正な入力として扱う。
func validateDecodedStoreImage(decoded image.Image, config image.Config) error {
	bounds := decoded.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width <= 0 || height <= 0 {
		return services.ErrInvalidImage
	}
	if width != config.Width || height != config.Height {
		return fmt.Errorf(
			"%w: config is %dx%d, decoded image is %dx%d",
			services.ErrInvalidImage,
			config.Width,
			config.Height,
			width,
			height,
		)
	}
	if int64(width) > maxStoreImagePixels/int64(height) {
		return services.ErrImageDimensionsExceeded
	}

	return nil
}

// resizeStoreImageは、縦横比を維持したまま長辺を上限値まで縮小する。
// 小さい画像は拡大せず、そのまま返す。
func resizeStoreImage(source image.Image) image.Image {
	bounds := source.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	longEdge := max(width, height)

	if longEdge <= maxStoreImageLongEdge {
		return source
	}

	scale := float64(maxStoreImageLongEdge) / float64(longEdge)
	destinationWidth := max(1, int(float64(width)*scale))
	destinationHeight := max(1, int(float64(height)*scale))
	destination := image.NewNRGBA(
		image.Rect(0, 0, destinationWidth, destinationHeight),
	)

	xdraw.ApproxBiLinear.Scale(
		destination,
		destination.Bounds(),
		source,
		bounds,
		xdraw.Src,
		nil,
	)

	return destination
}

// flattenStoreImageOnWhiteは、透明部分を白背景へ合成する。
// JPEGは透明度を保持できないため、再エンコード時に意図せず黒くなることを防ぐ。
func flattenStoreImageOnWhite(source image.Image) image.Image {
	bounds := source.Bounds()
	destination := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))

	stddraw.Draw(
		destination,
		destination.Bounds(),
		image.NewUniform(color.White),
		image.Point{},
		stddraw.Src,
	)
	stddraw.Draw(
		destination,
		destination.Bounds(),
		source,
		bounds.Min,
		stddraw.Over,
	)

	return destination
}

// encodeStoreImageJPEGは、画像を一定品質のJPEGへ再エンコードする。
// 再エンコードにより元画像のメタデータや画像末尾の余分なデータを保存対象から除外する。
func encodeStoreImageJPEG(source image.Image) ([]byte, error) {
	output := cappedBuffer{max: maxStoreImageOutputBytes}

	if err := jpeg.Encode(
		&output,
		source,
		&jpeg.Options{Quality: storeImageJPEGQuality},
	); err != nil {
		if errors.Is(err, services.ErrProcessedImageTooLarge) {
			return nil, err
		}
		return nil, fmt.Errorf("encode store image JPEG: %w", err)
	}

	return output.Bytes(), nil
}

// resetImageReaderは、複数回の検証とデコードに備えて読み取り位置を先頭へ戻す。
func resetImageReader(reader io.Seeker) error {
	if _, err := reader.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("reset store image reader: %w", err)
	}
	return nil
}

// cappedBufferは、エンコード中の出力が上限を超える前に書き込みを停止するバッファである。
// エンコード完了後にサイズを調べる方法と異なり、一時的なメモリ使用量も制限できる。
type cappedBuffer struct {
	buffer bytes.Buffer
	max    int
}

// Writeは、追加後のサイズが上限以内の場合だけデータを書き込む。
func (w *cappedBuffer) Write(data []byte) (int, error) {
	if w.buffer.Len()+len(data) > w.max {
		return 0, services.ErrProcessedImageTooLarge
	}
	return w.buffer.Write(data)
}

// Bytesは、現在までにバッファへ書き込まれたデータを返す。
func (w *cappedBuffer) Bytes() []byte {
	return w.buffer.Bytes()
}

var _ services.ImageProcessor = (*ImageProcessor)(nil)
