// kilocode_change - new file
import { TaskStatus } from "@roo-code/types"
import type { ActiveTaskTab } from "@roo/ExtensionMessage"

import { fireEvent, render, screen } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"
import { formatTimeAgo } from "@/utils/format"

import { TaskTabsBar } from "../TaskTabsBar"

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/utils/format", () => ({
	formatTimeAgo: vi.fn().mockReturnValue("1 minute ago"),
}))

describe("TaskTabsBar", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(formatTimeAgo).mockReturnValue("1 minute ago")
	})

	it("returns null when there are no tasks", () => {
		const { container } = render(<TaskTabsBar tasks={[]} />)
		expect(container.firstChild).toBeNull()
	})

	it("renders tabs and spinner for running task", () => {
		const tasks: ActiveTaskTab[] = [
			{
				id: "task-1",
				title: "Task One",
				status: TaskStatus.Running,
				isCurrent: false,
				isRunning: true,
				latestAssistantMessageTs: 1,
			},
			{
				id: "task-2",
				title: "Task Two",
				status: TaskStatus.Idle,
				isCurrent: true,
				isRunning: false,
			},
		]

		render(<TaskTabsBar tasks={tasks} />)

		expect(screen.getByText("Task One")).toBeInTheDocument()
		expect(screen.getByText("Task Two")).toBeInTheDocument()
		expect(screen.getByTestId("task-tab-loading-task-1")).toBeInTheDocument()
		expect(screen.queryByTestId("task-tab-loading-task-2")).not.toBeInTheDocument()
		expect(screen.getByTestId("task-tab-last-reply-task-1")).toHaveTextContent("1 minute ago")
		expect(formatTimeAgo).toHaveBeenCalledWith(1)
	})

	it("sends switchActiveTask when tab is clicked", () => {
		const tasks: ActiveTaskTab[] = [
			{
				id: "task-1",
				title: "Task One",
				status: TaskStatus.Running,
				isCurrent: true,
				isRunning: true,
			},
			{
				id: "task-2",
				title: "Task Two",
				status: TaskStatus.Running,
				isCurrent: false,
				isRunning: true,
			},
		]

		render(<TaskTabsBar tasks={tasks} />)

		fireEvent.click(screen.getByTestId("task-tab-task-2"))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "switchActiveTask",
			text: "task-2",
		})
	})

	it("sends closeActiveTask when close button is clicked", () => {
		const tasks: ActiveTaskTab[] = [
			{
				id: "task-1",
				title: "Task One",
				status: TaskStatus.Running,
				isCurrent: true,
				isRunning: true,
			},
		]

		render(<TaskTabsBar tasks={tasks} />)

		fireEvent.click(screen.getByTestId("task-tab-close-task-1"))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "closeActiveTask",
			text: "task-1",
		})
		expect(vscode.postMessage).not.toHaveBeenCalledWith({
			type: "switchActiveTask",
			text: "task-1",
		})
	})

	it("sends newTask when create button is clicked", () => {
		const tasks: ActiveTaskTab[] = [
			{
				id: "task-1",
				title: "Task One",
				status: TaskStatus.Running,
				isCurrent: true,
				isRunning: false,
			},
		]

		render(<TaskTabsBar tasks={tasks} />)

		fireEvent.click(screen.getByTestId("task-tab-create"))

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "newTask" })
	})
})
