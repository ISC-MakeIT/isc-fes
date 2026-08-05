package media

import (
	"errors"
	"io"
	"net/http"
)

var (
	ErrReadImageHeaderFailed = errors.New("failed to read store image header")
)

// 画像ファイルの先頭512バイトを読み込み、Content-Typeを判定する。
// http.DetectContentType が判定できる Content-Type を返す
// TODO: 空入力、短い入力、各対応形式、Seek 失敗、読み取り後の位置復元を単体テストで網羅する。
func DetectContentType(reader io.ReadSeeker) (string, error) {
	if _, err := reader.Seek(0, io.SeekStart); err != nil {
		return "", ErrReadImageHeaderFailed
	}

	var header [512]byte

	n, err := io.ReadFull(reader, header[:])
	if err != nil &&
		!errors.Is(err, io.EOF) &&
		!errors.Is(err, io.ErrUnexpectedEOF) {
		return "", ErrReadImageHeaderFailed
	}

	if n == 0 {
		return "", ErrReadImageHeaderFailed
	}

	contentType := http.DetectContentType(header[:n])

	if _, err := reader.Seek(0, io.SeekStart); err != nil {
		return "", ErrReadImageHeaderFailed
	}

	return contentType, nil
}
