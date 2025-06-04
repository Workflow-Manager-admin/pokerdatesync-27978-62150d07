import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PokerDateSync from "./PokerDateSync";

// Utility: returns YYYY-MM-DD string for a future date
function getFutureDate(days = 2) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function getFutureDateTime(minutes = 10) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

describe("PokerDateSync Integration Flows", () => {
  test("renders organizer setup and validates empty/invalid inputs", async () => {
    render(<PokerDateSync />);
    expect(screen.getByText(/organizer: enter up to 4 date options/i)).toBeInTheDocument();

    // Click send with no date
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));
    expect(await screen.findByText(/please enter at least one date/i)).toBeInTheDocument();

    // Enter duplicate date and check error
    const date1 = screen.getAllByLabelText(/date option/i)[0];
    const date2 = screen.getAllByLabelText(/date option/i)[1];
    const futureDate = getFutureDate();
    userEvent.clear(date1);
    userEvent.clear(date2);
    userEvent.type(date1, futureDate);
    userEvent.type(date2, futureDate); // duplicate
    // Fill deadline to skip that error
    userEvent.type(screen.getByLabelText(/response deadline/i), getFutureDateTime());
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));
    expect(await screen.findByText(/dates must be unique/i)).toBeInTheDocument();

    // Enter invalid date string
    userEvent.clear(date2);
    userEvent.type(date2, "2021-99-99");
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));
    expect(await screen.findByText(/enter valid iso date/i)).toBeInTheDocument();

    // Enter deadline in the past
    userEvent.clear(date2);
    userEvent.type(date2, getFutureDate(3));
    // Enter past datetime-local
    const past = new Date();
    past.setFullYear(2000);
    userEvent.clear(screen.getByLabelText(/response deadline/i));
    userEvent.type(screen.getByLabelText(/response deadline/i), past.toISOString().slice(0,16));
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));
    expect(await screen.findByText(/deadline must be in the future/i)).toBeInTheDocument();

    // Everything valid
    userEvent.clear(screen.getByLabelText(/response deadline/i));
    userEvent.type(screen.getByLabelText(/response deadline/i), getFutureDateTime(5));
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));
    expect(await screen.findByText(/member poll/i)).toBeInTheDocument();
  });

  test("progresses through poll phase: each member completes votes", async () => {
    render(<PokerDateSync />);
    // Set up 2 dates, 2 members for quick test
    const dateInputs = screen.getAllByLabelText(/date option/i);
    userEvent.clear(dateInputs[0]);
    userEvent.clear(dateInputs[1]);
    userEvent.type(dateInputs[0], getFutureDate());
    userEvent.type(dateInputs[1], getFutureDate(3));
    userEvent.type(screen.getByLabelText(/response deadline/i), getFutureDateTime(3));
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));

    // Should be at "Member Poll" phase with 2 dates
    expect(await screen.findByText(/member poll/i)).toBeInTheDocument();
    // Should see progress text
    expect(screen.getByText(/progress:/i)).toHaveTextContent("0 / 12");

    // For first Member, choose Yes for both dates
    let rows = screen.getAllByRole("row");
    // The first poll row should have buttons for Yes/Tentative/No for each date
    const yesButtons = screen.getAllByRole("button", { name: /^yes$/i });
    expect(yesButtons.length).toBeGreaterThanOrEqual(2);
    yesButtons.forEach(btn => userEvent.click(btn));

    // Save for this member
    const saveBtn = screen.getByRole("button", { name: /save for member 1/i });
    expect(saveBtn).toBeEnabled();
    userEvent.click(saveBtn);

    // Should move to Member 2, progress increases
    expect(screen.getByText(/member 2 of 12/i)).toBeInTheDocument();
    expect(screen.getByText(/progress:/i)).toHaveTextContent("1 / 12");

    // Select mixed responses for second member
    const buttons = screen.getAllByRole("button", { name: /^yes$|^tentative$|^no$/i });
    userEvent.click(buttons[0]); // Yes for date 1
    userEvent.click(buttons[3]); // No for date 2
    userEvent.click(screen.getByRole("button", { name: /save for member 2/i }));

    // Should wrap to member 3, progress: 2/12
    expect(screen.getByText(/member 3 of 12/i)).toBeInTheDocument();
    expect(screen.getByText(/progress:/i)).toHaveTextContent("2 / 12");
  });

  test("shows error on incomplete member responses and disables Save", async () => {
    render(<PokerDateSync />);
    userEvent.type(screen.getAllByLabelText(/date option/i)[0], getFutureDate());
    userEvent.type(screen.getByLabelText(/response deadline/i), getFutureDateTime());
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));

    // Only fill for first date
    const yesBtn = screen.getAllByRole("button", { name: /^yes$/i })[0];
    userEvent.click(yesBtn);

    // Save should be disabled
    const saveBtn = screen.getByRole("button", { name: /save for member 1/i });
    expect(saveBtn).toBeDisabled();
  });

  test("end poll early jumps to results and highlights best dates", async () => {
    render(<PokerDateSync />);
    userEvent.type(screen.getAllByLabelText(/date option/i)[0], getFutureDate());
    userEvent.type(screen.getAllByLabelText(/date option/i)[1], getFutureDate(2));
    userEvent.type(screen.getByLabelText(/response deadline/i), getFutureDateTime(2));
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));

    // Fill all Yes for the first date for two members, then End Poll Early
    for (let i = 0; i < 2; i++) {
      screen.getAllByRole("button", { name: /^yes$/i }).forEach(btn => userEvent.click(btn));
      userEvent.click(screen.getByRole("button", { name: /save for member/i }));
    }
    // End poll early
    userEvent.click(screen.getByRole("button", { name: /end poll early/i }));

    // Should see "Best Date(s)" heading
    expect(await screen.findByText(/best date/i)).toBeInTheDocument();

    // The best date should be visually rendered (blue background)
    const bestCell = screen.getAllByText((_content, el) =>
      el && el.style && el.style.background && el.style.background.includes("#0d46d9")
    );
    expect(bestCell.length).toBeGreaterThanOrEqual(1);

    // Also, "Full Voting Results" and correct table structure
    expect(screen.getByText(/full voting results/i)).toBeInTheDocument();

    // New poll button resets everything
    userEvent.click(screen.getByRole("button", { name: /start new poll/i }));
    expect(screen.getByText(/organizer: enter up to 4 date options/i)).toBeInTheDocument();
  });

  test("full happy path: complete poll and results tally", async () => {
    render(<PokerDateSync />);
    const date1 = getFutureDate();
    const date2 = getFutureDate(2);

    userEvent.type(screen.getAllByLabelText(/date option/i)[0], date1);
    userEvent.type(screen.getAllByLabelText(/date option/i)[1], date2);
    userEvent.type(screen.getByLabelText(/response deadline/i), getFutureDateTime(10));
    fireEvent.click(screen.getByRole("button", { name: /send poll/i }));

    // Each member: alternate between Yes/No and Tentative/Yes
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) {
        screen.getAllByRole("button", { name: /^yes$/i })[0] && userEvent.click(screen.getAllByRole("button", { name: /^yes$/i })[0]);
        screen.getAllByRole("button", { name: /^no$/i })[1] && userEvent.click(screen.getAllByRole("button", { name: /^no$/i })[1]);
      } else {
        screen.getAllByRole("button", { name: /^tentative$/i })[0] && userEvent.click(screen.getAllByRole("button", { name: /^tentative$/i })[0]);
        screen.getAllByRole("button", { name: /^yes$/i })[1] && userEvent.click(screen.getAllByRole("button", { name: /^yes$/i })[1]);
      }
      userEvent.click(screen.getByRole("button", { name: /save for member/i }));
    }

    // End poll early to force results
    userEvent.click(screen.getByRole("button", { name: /end poll early/i }));
    expect(await screen.findByText(/best date/i)).toBeInTheDocument();

    // Table headers for both dates
    expect(screen.getAllByText(new RegExp(new Date(date1).toLocaleDateString(), "i")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(new Date(date2).toLocaleDateString(), "i")).length).toBeGreaterThan(0);

    // "Total" row must show correct tally row (Yes, Tent, No)
    expect(screen.getAllByText(/yes: [0-9]/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/tent: [0-9]/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/no: [0-9]/i).length).toBeGreaterThanOrEqual(2);
  });
});
