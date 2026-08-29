package buildinfo

import "time"

var (
	// CommitHash と DeployedAt は、ビルド時に -ldflags で埋め込まれる
	CommitHash = "development"
	DeployedAt string
)

var startedAt = time.Now().UTC()

// 開発環境では、DeployedAt は空文字列のままなので、startedAt にフォールバックする
func DeploymentTime() time.Time {
	deployedAt, err := time.Parse(time.RFC3339, DeployedAt)
	if err != nil {
		return startedAt
	}

	return deployedAt
}
