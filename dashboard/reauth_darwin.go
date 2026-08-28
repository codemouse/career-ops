//go:build darwin

package main

import (
	"fmt"
	"strings"
)

// openTerminalRunning launches command in dir inside a new, visible
// Terminal.app window via osascript. Used for interactive scripts (e.g.
// plugins/gmail/reauth.mjs) that block on user browser interaction and must
// not be run headlessly inside a tea.Cmd goroutine.
func openTerminalRunning(dir string, command string) error {
	shellCmd := fmt.Sprintf("cd %s && %s", shellQuote(dir), command)
	script := fmt.Sprintf(`tell application "Terminal" to do script %s`, appleScriptQuote(shellCmd))
	return runReauthCommand("osascript", "-e", `tell application "Terminal" to activate`, "-e", script)
}

// shellQuote wraps s in single quotes for safe use as one shell argument.
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// appleScriptQuote escapes s and wraps it in double quotes for safe
// interpolation as an AppleScript string literal.
func appleScriptQuote(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	return `"` + s + `"`
}
