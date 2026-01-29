import { useRef, useState, useEffect } from "react"
import { useWindowSize, useClickAway } from "react-use"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import styled from "styled-components"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip"
import { vscode } from "@/utils/vscode"
import BottomButton from "../BottomButton"

import RulesWorkflowsSection from "./RulesWorkflowsSection"

const sortedRules = (data: Record<string, unknown> | undefined) =>
	Object.entries(data || {})
		.map(([path, enabled]): [string, boolean] => [path, enabled as boolean])
		.sort(([a], [b]) => a.localeCompare(b))

interface DescriptionWithLinkProps {
	children: React.ReactNode
	href: string
	linkText: string
}

const DescriptionWithLink: React.FC<DescriptionWithLinkProps> = ({ children, href, linkText }) => (
	<p>
		{children}{" "}
		<VSCodeLink href={href} style={{ display: "inline" }} className="text-xs">
			{linkText}
		</VSCodeLink>
	</p>
)

interface KiloRulesToggleModalProps {
	hideTrigger?: boolean
}

const KiloRulesToggleModal: React.FC<KiloRulesToggleModalProps> = ({ hideTrigger = false }) => {
	const { t } = useTranslation()

	const [isVisible, setIsVisible] = useState(false)
	// kilocode_change start
	const previousViewportWidthRef = useRef<number | null>(null)
	const didInitializePositionRef = useRef(false)
	// kilocode_change end
	const buttonRef = useRef<HTMLDivElement>(null)
	const modalRef = useRef<HTMLDivElement>(null)
	const { width: viewportWidth, height: viewportHeight } = useWindowSize()
	const [arrowPosition, setArrowPosition] = useState(0)
	const [menuPosition, setMenuPosition] = useState(0)
	const [currentView, setCurrentView] = useState<"rule" | "workflow">("rule")
	const [localRules, setLocalRules] = useState<[string, boolean][]>([])
	const [globalRules, setGlobalRules] = useState<[string, boolean][]>([])
	const [localWorkflows, setLocalWorkflows] = useState<[string, boolean][]>([])
	const [globalWorkflows, setGlobalWorkflows] = useState<[string, boolean][]>([])

	useEffect(() => {
		if (isVisible) {
			vscode.postMessage({ type: "refreshRules" })
		}
	}, [isVisible])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "rulesData") {
				setLocalRules(sortedRules(message.localRules))
				setGlobalRules(sortedRules(message.globalRules))
				setLocalWorkflows(sortedRules(message.localWorkflows))
				setGlobalWorkflows(sortedRules(message.globalWorkflows))
				return
			}

			if (message.type === "action" && message.action === "rulesButtonClicked") {
				setIsVisible((prev) => !prev)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const toggleRule = (isGlobal: boolean, rulePath: string, enabled: boolean) => {
		vscode.postMessage({
			type: "toggleRule",
			rulePath,
			enabled,
			isGlobal,
		})
	}

	const toggleWorkflow = (isGlobal: boolean, workflowPath: string, enabled: boolean) => {
		vscode.postMessage({
			type: "toggleWorkflow",
			workflowPath,
			enabled,
			isGlobal,
		})
	}

	useClickAway(modalRef, () => {
		setIsVisible(false)
	})

	useEffect(() => {
		if (!isVisible) {
			// kilocode_change start
			previousViewportWidthRef.current = null
			didInitializePositionRef.current = false
			// kilocode_change end
			return
		}

		// Freeze the vertical position after the modal is opened.
		// We still update arrowPosition on viewport changes to keep the pointer aligned horizontally.
		const shouldInitializePosition = !didInitializePositionRef.current

		if (hideTrigger || !buttonRef.current) {
			setArrowPosition(20)
			if (shouldInitializePosition) {
				setMenuPosition(40)
			}
			// kilocode_change start
			previousViewportWidthRef.current = viewportWidth
			didInitializePositionRef.current = true
			// kilocode_change end
			return
		}

		const buttonRect = buttonRef.current.getBoundingClientRect()
		const buttonCenter = buttonRect.left + buttonRect.width / 2
		const rightPosition = document.documentElement.clientWidth - buttonCenter - 5
		// kilocode_change start
		const nextMenuPosition = buttonRect.top + 1

		const previousViewportWidth = previousViewportWidthRef.current
		const isWidthShrinking = previousViewportWidth !== null && viewportWidth < previousViewportWidth
		// kilocode_change end

		setArrowPosition(rightPosition)
		// kilocode_change start
		if (shouldInitializePosition) {
			setMenuPosition((prev) => {
				// On first open, if layout is already in flux (e.g. width shrinking),
				// preserve the previous behavior of not allowing a sudden downward jump.
				if (!isWidthShrinking) {
					return nextMenuPosition
				}
				if (prev === 0) {
					return nextMenuPosition
				}
				return Math.min(prev, nextMenuPosition)
			})
		}

		previousViewportWidthRef.current = viewportWidth
		didInitializePositionRef.current = true
		// kilocode_change end
	}, [isVisible, viewportWidth, viewportHeight, hideTrigger])

	return (
		<div ref={modalRef}>
			<div
				ref={buttonRef}
				className={`inline-flex min-w-0 max-w-full${hideTrigger ? " opacity-0 pointer-events-none select-none" : ""}`}>
				<TooltipProvider>
					<Tooltip open={isVisible ? false : undefined}>
						<TooltipTrigger asChild>
							<BottomButton
								iconClass="codicon-law"
								ariaLabel={t("kilocode:rules.ariaLabel")}
								onClick={() => setIsVisible(!isVisible)}
							/>
						</TooltipTrigger>
						<TooltipContent>{t("kilocode:rules.tooltip")}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			{isVisible && (
				<div
					data-testid="kilo-rules-toggle-modal"
					className="fixed left-[15px] right-[15px] border border-[var(--vscode-editorGroup-border)] p-3 rounded z-[1000] overflow-y-auto"
					style={{
						bottom: `calc(100vh - ${menuPosition}px + 6px)`,
						background: "var(--vscode-editor-background)",
						maxHeight: "calc(100vh - 100px)",
						overscrollBehavior: "contain",
					}}>
					<div
						className="fixed w-[10px] h-[10px] z-[-1] rotate-45 border-r border-b border-[var(--vscode-editorGroup-border)]"
						style={{
							bottom: `calc(100vh - ${menuPosition}px)`,
							right: arrowPosition,
							background: "var(--vscode-editor-background)",
						}}
					/>

					<div
						style={{
							display: "flex",
							flexWrap: "wrap",
							columnGap: "8px",
							rowGap: "8px",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "10px",
						}}>
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								gap: "1px",
								borderBottom: "1px solid var(--vscode-panel-border)",
								maxWidth: "100%",
							}}>
							<StyledTabButton $isActive={currentView === "rule"} onClick={() => setCurrentView("rule")}>
								{t("kilocode:rules.tabs.rules")}
							</StyledTabButton>
							<StyledTabButton
								$isActive={currentView === "workflow"}
								onClick={() => setCurrentView("workflow")}>
								{t("kilocode:rules.tabs.workflows")}
							</StyledTabButton>
						</div>
					</div>

					<div className="text-xs text-[var(--vscode-descriptionForeground)] mb-4">
						{currentView === "rule" ? (
							<DescriptionWithLink
								href="https://kilo.ai/docs/advanced-usage/custom-rules"
								linkText={t("kilocode:docs")}>
								{t("kilocode:rules.description.rules")}
							</DescriptionWithLink>
						) : (
							<DescriptionWithLink
								href="https://kilo.ai/docs/features/slash-commands/workflows"
								linkText={t("kilocode:docs")}>
								{t("kilocode:rules.description.workflows")}{" "}
								<span className="text-[var(--vscode-foreground)] font-bold">/workflow-name</span>{" "}
								{t("kilocode:rules.description.workflowsInChat")}
							</DescriptionWithLink>
						)}
					</div>

					<RulesWorkflowsSection
						type={currentView}
						globalItems={currentView === "rule" ? globalRules : globalWorkflows}
						localItems={currentView === "rule" ? localRules : localWorkflows}
						toggleGlobal={(path: string, enabled: boolean) =>
							currentView === "rule"
								? toggleRule(true, path, enabled)
								: toggleWorkflow(true, path, enabled)
						}
						toggleLocal={(path: string, enabled: boolean) =>
							currentView === "rule"
								? toggleRule(false, path, enabled)
								: toggleWorkflow(false, path, enabled)
						}
					/>
				</div>
			)}
		</div>
	)
}

const StyledTabButton = styled.button<{ $isActive: boolean }>`
	background: none;
	border: none;
	border-bottom: 2px solid ${(props) => (props.$isActive ? "var(--vscode-foreground)" : "transparent")};
	color: ${(props) => (props.$isActive ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)")};
	padding: 8px 16px;
	cursor: pointer;
	font-size: 13px;
	margin-bottom: -1px;
	font-family: inherit;

	&:hover {
		color: var(--vscode-foreground);
	}
`

export default KiloRulesToggleModal
