//go:build !windows && !darwin && !linux

package main

import (
	"fmt"
	"runtime"
)

// openTerminalRunning is unsupported on this platform.
func openTerminalRunning(dir string, command string) error {
	return fmt.Errorf("launching a terminal window is not supported on %s", runtime.GOOS)
}
