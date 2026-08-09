package media

import (
	"image"
	"io"
	"time"

	"github.com/bep/imagemeta"
)

// storeImageOrientationは、EXIFで定義される画像の表示方向を表す。
// 値は通常方向を1として、回転と反転の組み合わせを8までで表現する。
type storeImageOrientation uint16

// EXIFで定義されている8種類の画像方向と、メタデータ解析の制限時間。
const (
	storeImageOrientationNormal      storeImageOrientation = 1
	storeImageOrientationFlipH       storeImageOrientation = 2
	storeImageOrientationRotate180   storeImageOrientation = 3
	storeImageOrientationFlipV       storeImageOrientation = 4
	storeImageOrientationTranspose   storeImageOrientation = 5
	storeImageOrientationRotate90CW  storeImageOrientation = 6
	storeImageOrientationTransverse  storeImageOrientation = 7
	storeImageOrientationRotate270CW storeImageOrientation = 8
	storeImageMetadataDecodeTimeout                        = 250 * time.Millisecond
)

// extractStoreImageOrientationは、画像のEXIFから表示方向を取得する。
// EXIFが存在しない場合やメタデータが壊れている場合は、画像本体を優先して通常方向として扱う。
func extractStoreImageOrientation(
	reader io.ReadSeeker,
	format string,
) storeImageOrientation {
	imageFormat, supported := imageMetadataFormat(format)
	if !supported {
		return storeImageOrientationNormal
	}
	if err := resetImageReader(reader); err != nil {
		return storeImageOrientationNormal
	}

	orientation := storeImageOrientationNormal
	_, err := imagemeta.Decode(imagemeta.Options{
		R:           reader,
		ImageFormat: imageFormat,
		Sources:     imagemeta.EXIF,
		ShouldHandleTag: func(tag imagemeta.TagInfo) bool {
			return tag.Tag == "Orientation"
		},
		HandleTag: func(tag imagemeta.TagInfo) error {
			if value, ok := orientationValue(tag.Value); ok {
				orientation = value
			}
			return imagemeta.ErrStopWalking
		},
		Warnf:        func(string, ...any) {},
		Timeout:      storeImageMetadataDecodeTimeout,
		LimitNumTags: 64,
		LimitTagSize: 64,
	})
	if err != nil {
		return storeImageOrientationNormal
	}

	return orientation
}

// imageMetadataFormatは、画像デコーダーが返した形式名をメタデータ解析用の形式へ変換する。
func imageMetadataFormat(format string) (imagemeta.ImageFormat, bool) {
	switch format {
	case "jpeg":
		return imagemeta.JPEG, true
	case "png":
		return imagemeta.PNG, true
	case "webp":
		return imagemeta.WebP, true
	default:
		return imagemeta.ImageFormatAuto, false
	}
}

// orientationValueは、EXIFタグの値を画像方向へ変換し、1から8までの範囲内か検証する。
func orientationValue(value any) (storeImageOrientation, bool) {
	var orientation storeImageOrientation

	switch value := value.(type) {
	case uint16:
		orientation = storeImageOrientation(value)
	case uint32:
		orientation = storeImageOrientation(value)
	case int:
		orientation = storeImageOrientation(value)
	default:
		return storeImageOrientationNormal, false
	}

	if orientation < storeImageOrientationNormal ||
		orientation > storeImageOrientationRotate270CW {
		return storeImageOrientationNormal, false
	}

	return orientation, true
}

// applyStoreImageOrientationは、EXIFの画像方向情報が表す回転と反転を画素へ適用する。
// 方向補正後にJPEGへ再エンコードすることで、配信側がEXIFを解釈しなくても正しい向きで表示できる。
func applyStoreImageOrientation(
	source image.Image,
	orientation storeImageOrientation,
) image.Image {
	if orientation == storeImageOrientationNormal {
		return source
	}

	bounds := source.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	destinationWidth := width
	destinationHeight := height
	if orientation >= storeImageOrientationTranspose {
		destinationWidth = height
		destinationHeight = width
	}

	destination := image.NewNRGBA(
		image.Rect(0, 0, destinationWidth, destinationHeight),
	)

	for y := range height {
		for x := range width {
			destinationX, destinationY := orientedCoordinates(
				x,
				y,
				width,
				height,
				orientation,
			)
			destination.Set(
				destinationX,
				destinationY,
				source.At(bounds.Min.X+x, bounds.Min.Y+y),
			)
		}
	}

	return destination
}

// orientedCoordinatesは、元画像の座標を指定された画像方向に対応する出力座標へ変換する。
// 反転を含む全8方向を個別に扱い、画素の補間を行わず元の色を維持する。
func orientedCoordinates(
	x int,
	y int,
	width int,
	height int,
	orientation storeImageOrientation,
) (int, int) {
	switch orientation {
	case storeImageOrientationFlipH:
		return width - 1 - x, y
	case storeImageOrientationRotate180:
		return width - 1 - x, height - 1 - y
	case storeImageOrientationFlipV:
		return x, height - 1 - y
	case storeImageOrientationTranspose:
		return y, x
	case storeImageOrientationRotate90CW:
		return height - 1 - y, x
	case storeImageOrientationTransverse:
		return height - 1 - y, width - 1 - x
	case storeImageOrientationRotate270CW:
		return y, width - 1 - x
	default:
		return x, y
	}
}
