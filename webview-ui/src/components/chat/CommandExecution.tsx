import { useCallback, useState, useMemo } from "react"
import { useEvent } from "react-use"
import { t } from "i18next"
import { OctagonX } from "lucide-react"

import { CommandExecutionStatus, commandExecutionStatusSchema } from "@roo-code/types"

import { ExtensionMessage } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"

import { COMMAND_OUTPUT_STRING } from "@roo/combineCommandSequences"
import { parseCommand } from "@roo/parse-command"

import { vscode } from "@src/utils/vscode"
import { extractPatternsFromCommand } from "@src/utils/command-parser"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import { Button, StandardTooltip } from "@src/components/ui"
import { CompactToolDisplay } from "./CompactToolDisplay"
import { ToolResultDisplay } from "./ToolResultDisplay"
import { CommandPatternSelector } from "./CommandPatternSelector"

interface CommandPattern {
  pattern: string
  description?: string
}

interface CommandExecutionProps {
  executionId: string
  text?: string
  icon?: JSX.Element | null
  title?: JSX.Element | null
}

export const CommandExecution = ({ executionId, text, icon, title }: CommandExecutionProps) => {
  const {
    terminalShellIntegrationDisabled = true,
    allowedCommands = [],
    deniedCommands = [],
    setAllowedCommands,
    setDeniedCommands,
  } = useExtensionState()

  const { command, output: parsedOutput } = useMemo(() => parseCommandAndOutput(text), [text])
  const [forceExpanded, setForceExpanded] = useState(terminalShellIntegrationDisabled)
  const [streamingOutput, setStreamingOutput] = useState("")
  const [status, setStatus] = useState<CommandExecutionStatus | null>(null)

  // The command's output can either come from the text associated with the
  // task message (this is the case for completed commands) or from the
  // streaming output (this is the case for running commands).
  const output = streamingOutput || parsedOutput
  const isRunning = status?.status === "started"
  const isError =
    status?.status === "timeout" ||
    (status?.status === "exited" && status.exitCode !== undefined && status.exitCode !== 0)

  // Extract command patterns from the actual command that was executed
  const commandPatterns = useMemo<CommandPattern[]>(() => {
    // First get all individual commands (including subshell commands) using parseCommand
    const allCommands = parseCommand(command)

    // Then extract patterns from each command using the existing pattern extraction logic
    const allPatterns = new Set<string>()

    // Add all individual commands first
    allCommands.forEach((cmd) => {
      if (cmd.trim()) {
        allPatterns.add(cmd.trim())
      }
    })

    // Then add extracted patterns for each command
    allCommands.forEach((cmd) => {
      const patterns = extractPatternsFromCommand(cmd)
      patterns.forEach((pattern) => allPatterns.add(pattern))
    })

    return Array.from(allPatterns).map((pattern) => ({
      pattern,
    }))
  }, [command])

  // Handle pattern changes
  const handleAllowPatternChange = (pattern: string) => {
    const isAllowed = allowedCommands.includes(pattern)
    const newAllowed = isAllowed ? allowedCommands.filter((p) => p !== pattern) : [...allowedCommands, pattern]
    const newDenied = deniedCommands.filter((p) => p !== pattern)

    setAllowedCommands(newAllowed)
    setDeniedCommands(newDenied)

    vscode.postMessage({
      type: "updateSettings",
      updatedSettings: { allowedCommands: newAllowed, deniedCommands: newDenied },
    })
  }

  const handleDenyPatternChange = (pattern: string) => {
    const isDenied = deniedCommands.includes(pattern)
    const newDenied = isDenied ? deniedCommands.filter((p) => p !== pattern) : [...deniedCommands, pattern]
    const newAllowed = allowedCommands.filter((p) => p !== pattern)

    setAllowedCommands(newAllowed)
    setDeniedCommands(newDenied)

    vscode.postMessage({
      type: "updateSettings",
      updatedSettings: { allowedCommands: newAllowed, deniedCommands: newDenied },
    })
  }

  const onMessage = useCallback(
    (event: MessageEvent) => {
      const message: ExtensionMessage = event.data

      if (message.type === "commandExecutionStatus") {
        const result = commandExecutionStatusSchema.safeParse(safeJsonParse(message.text, {}))

        if (result.success) {
          const data = result.data

          if (data.executionId !== executionId) {
            return
          }

          switch (data.status) {
            case "started":
              setStatus(data)
              break
            case "output":
              setStreamingOutput(data.output)
              break
            case "fallback":
              setForceExpanded(true)
              break
            default:
              setStatus(data)
              break
          }
        }
      }
    },
    [executionId],
  )

  useEvent("message", onMessage)

  return (
    <>
      {(icon || title) && (
        <div className="flex flex-row items-center gap-2 mb-1">
          {icon}
          {title}
          {status?.status === "exited" && (
            <div className="flex flex-row items-center gap-2 font-mono text-xs">
              <StandardTooltip
                content={t("chat.commandExecution.exitStatus", { exitStatus: status.exitCode })}>
                <div
                  className={
                    "rounded-full size-2 " +
                    (status.exitCode === 0 ? "bg-green-600" : "bg-red-600")
                  }
                />
              </StandardTooltip>
            </div>
          )}
        </div>
      )}
      <div className="pl-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <CompactToolDisplay toolName="execute_command" params={command} />
          </div>
          {isRunning && (
            <StandardTooltip content={t("chat:commandExecution.abort")}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  vscode.postMessage({
                    type: "terminalOperation",
                    terminalOperation: "abort",
                  })
                }>
                <OctagonX className="size-4" />
              </Button>
            </StandardTooltip>
          )}
        </div>
        <ToolResultDisplay
          key={forceExpanded ? "force-expanded" : "default"}
          resultText={output}
          isRunning={isRunning}
          isError={isError}
          defaultExpanded={forceExpanded}
        />
        {command && command.trim() && (
          <div className="ml-6 mt-2">
            <CommandPatternSelector
              patterns={commandPatterns}
              allowedCommands={allowedCommands}
              deniedCommands={deniedCommands}
              onAllowPatternChange={handleAllowPatternChange}
              onDenyPatternChange={handleDenyPatternChange}
            />
          </div>
        )}
      </div>
    </>
  )
}

CommandExecution.displayName = "CommandExecution"

const parseCommandAndOutput = (text: string | undefined) => {
	if (!text) {
		return { command: "", output: "" }
	}

	const index = text.indexOf(COMMAND_OUTPUT_STRING)

	if (index === -1) {
		return { command: text, output: "" }
	}

	return {
		command: text.slice(0, index),
		output: text.slice(index + COMMAND_OUTPUT_STRING.length),
	}
}
