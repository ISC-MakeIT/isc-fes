package auth

import (
	"net/http"

	"github.com/alexedwards/scs/v2"
)

func configureSessionCookie(
	manager *scs.SessionManager,
	name string,
	secure bool,
	domain string,
) {
	manager.Cookie.Name = name
	manager.Cookie.Path = "/"
	manager.Cookie.Domain = domain
	manager.Cookie.HttpOnly = true
	manager.Cookie.SameSite = http.SameSiteLaxMode
	manager.Cookie.Secure = secure
	manager.Cookie.Persist = true
}
