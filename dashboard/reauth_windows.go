//go:build windows

package main

import (
	"fmt"
	"os/exec"
)

// runReauthCommandWindows executes name with args. Overridable for tests.
var runReauthCommandWindows = func(name string, args ...string) error {
	return exec.Command(name, args...).Run()
}

// openTerminalRunning launches command in dir inside a new, visible console
// window via `cmd /c start`. Used for interactive scripts (e.g.
// plugins/gmail/reauth.mjs) that block on user browser interaction and must
// not be run headlessly inside a tea.Cmd goroutine.
func openTerminalRunning(dir string, command string) error {
	// start's first quoted argument is the window title, not the command —
	// pass an empty title so `command` isn't swallowed into it.
	shellCmd := fmt.Sprintf("cd /d %s && %s", dir, command)
	return runReauthCommandWindows("cmd", "/c", "start", "", "cmd", "/k", shellCmd)
}
