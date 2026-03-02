# Agent Lint — full workflow demo (hero GIF)
# Records: init → doctor → prompt in sequence

Output docs/screenshots/demo-workflow.gif

Set Shell "powershell"
Set FontSize 14
Set Width 100
Set Height 38
Set Theme "Catppuccin Mocha"
Set Framerate 24
Set PlaybackSpeed 0.8
Set TypingSpeed 55ms
Set Padding 16
Set LoopOffset 60%

# Step 1 — init
Type "node packages/cli/dist/index.js init"
Sleep 400ms
Enter
Sleep 3s

# Clear screen
Ctrl+L
Sleep 500ms

# Step 2 — doctor
Type "node packages/cli/dist/index.js doctor"
Sleep 400ms
Enter
Sleep 3s

# Clear screen
Ctrl+L
Sleep 500ms

# Step 3 — prompt
Type "node packages/cli/dist/index.js prompt"
Sleep 400ms
Enter
Sleep 3s
