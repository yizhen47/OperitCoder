import { render } from "@/utils/test-utils"
import { CloudView } from "../CloudView"

describe("CloudView", () => {
	it("renders nothing", () => {
		const { container } = render(
			<CloudView userInfo={null} isAuthenticated={false} cloudApiUrl="https://app.example.com" />,
		)
		expect(container).toBeEmptyDOMElement()
	})
})
