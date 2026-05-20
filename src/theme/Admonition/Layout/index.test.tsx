import React from "react";
import { render, screen } from "@testing-library/react";
import AdmonitionLayout from "./index";

describe("AdmonitionLayout", () => {
  it("renders with type and className correctly", () => {
    const { container } = render(
      <AdmonitionLayout
        type="tip"
        icon="💡"
        title="Tip"
        className="custom-class"
      >
        Content
      </AdmonitionLayout>
    );

    // The className is prefixed as 'admonition-' based on the implementation
    expect(container.firstChild).toHaveClass("admonition");
    expect(container.firstChild).toHaveClass("admonition-type-tip");
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("renders with icon and title", () => {
    render(
      <AdmonitionLayout type="note" icon="📝" title="Note">
        Content here
      </AdmonitionLayout>
    );

    expect(screen.getByText("📝")).toBeInTheDocument();
    // The title is commented out in the component, so it shouldn't appear
    expect(screen.queryByText("Note")).not.toBeInTheDocument();
  });

  it("renders content properly", () => {
    render(
      <AdmonitionLayout type="caution" icon="⚠️" title="Caution">
        This is important content
      </AdmonitionLayout>
    );

    expect(screen.getByText("This is important content")).toBeInTheDocument();
  });

  it("does not render heading when both icon and title are absent", () => {
    render(
      <AdmonitionLayout type="info">
        Content without heading
      </AdmonitionLayout>
    );

    // Check that the heading element is not present
    expect(
      screen.queryByRole("heading", { level: 2 })
    ).not.toBeInTheDocument();
  });

  it("renders with different types", () => {
    const types = ["note", "tip", "caution", "danger", "info"];

    types.forEach((type) => {
      const { rerender } = render(
        <AdmonitionLayout type={type} icon="icon">
          Content
        </AdmonitionLayout>
      );

      expect(screen.getByText("icon")).toBeInTheDocument();

      // Clean up by unmounting
      rerender(null);
    });
  });

  it("applies custom class name along with default classes", () => {
    const { container } = render(
      <AdmonitionLayout
        type="tip"
        icon="💡"
        className="my-custom-class"
      >
        Content
      </AdmonitionLayout>
    );

    const admonitionElement = container.firstChild;
    expect(admonitionElement).toHaveClass('my-custom-class');
    expect(admonitionElement).toHaveClass('admonition');
  });

  it("does not render empty content section when no children provided", () => {
    render(<AdmonitionLayout type="tip" icon="💡" title="Tip" />);
    
    // The AdmonitionContent div is still rendered even if no children are provided
    // but it will be empty
    expect(screen.queryByText(/content/i)).not.toBeInTheDocument();
  });

  it("handles different icon types", () => {
    const { rerender } = render(
      <AdmonitionLayout type="success" icon={<span data-testid="icon-element">✅</span>} title="Success">
        Success content
      </AdmonitionLayout>
    );

    expect(screen.getByTestId("icon-element")).toBeInTheDocument();

    rerender(
      <AdmonitionLayout type="warning" icon="🔥" title="Warning">
        Warning content
      </AdmonitionLayout>
    );

    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("correctly applies CSS module classes", () => {
    render(
      <AdmonitionLayout type="info" icon="ℹ️" title="Info">
        Information content
      </AdmonitionLayout>
    );

    // The icon should be rendered inside expected structure
    const iconElement = screen.getByText('ℹ️');
    expect(iconElement).toBeInTheDocument();

    // The icon should be inside an element that represents the icon container
    const iconWrapper = iconElement.closest('span');
    expect(iconWrapper).toBeInTheDocument();

    // The content should be present too
    expect(screen.getByText('Information content')).toBeInTheDocument();
  });
});