import React, { useState } from "react";

/*
  PokerDateSync Main Container

  - Organizer inputs up to 4 dates and a response deadline.
  - "Send poll" moves to poll phase. Display table for 12 members (mock names).
  - Each member marks YES/NO/TENTATIVE per date.
  - After the deadline, results are calculated and best date(s) highlighted.
  - All styling uses a custom card design with provided colors/theme.

  Colors:
    primary: #0d46d9
    secondary: #0a0a0a
    accent: #E94F37
  Theme: light
*/

// PUBLIC_INTERFACE
function PokerDateSync() {
  // --- Organizer state ---
  const [dates, setDates] = useState(["", "", "", ""]);
  const [deadline, setDeadline] = useState("");
  const [phase, setPhase] = useState("setup"); // "setup" | "poll" | "results"
  const [organizerError, setOrganizerError] = useState("");

  // --- Poll/mock member state ---
  const defaultMembers = Array.from({ length: 12 }, (_, i) => `Member ${i + 1}`);

  // Each member's responses: [{date: string, responses: ['yes'|'no'|'tentative', ...]}]
  const [memberResponses, setMemberResponses] = useState(
    // Array of 12 members, each with array of 4 nulls at first
    Array.from({ length: 12 }, () => Array(4).fill(null))
  );
  // Track which member is being polled (in real world, this would be split per-user)
  const [currentMemberIdx, setCurrentMemberIdx] = useState(0);

  // --- Results and time simulation ---
  const [pollCloseTime, setPollCloseTime] = useState(null);
  const [results, setResults] = useState(null);
  const [deadlineExpired, setDeadlineExpired] = useState(false);

  // --- Color Theme/Styling tokens ---
  const colors = {
    primary: "#0d46d9",
    secondary: "#0a0a0a",
    accent: "#E94F37",
    card: "#fff",
    text: "#222",
    shadow: "rgba(13,70,217,0.1)",
    lightBg: "#f5f8fa",
  };

  // --- Form Handlers ---
  const handleDateChange = (idx, value) => {
    setDates((prev) => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  const handleDeadlineChange = (e) => {
    setDeadline(e.target.value);
  };

  // --- Organizer submits dates/deadline ---
  const handleSetupSubmit = (e) => {
    e.preventDefault();
    setOrganizerError("");
    // Validate dates: At least one, all filled non-empty, no duplicates, valid future dates
    const cleanDates = dates.map((d) => d.trim()).filter((d) => !!d);
    if (cleanDates.length === 0) {
      setOrganizerError("Please enter at least one date.");
      return;
    }
    if (new Set(cleanDates).size !== cleanDates.length) {
      setOrganizerError("Dates must be unique.");
      return;
    }
    if (cleanDates.some((d) => isNaN(Date.parse(d)))) {
      setOrganizerError("Enter valid ISO date for all dates.");
      return;
    }
    // Deadline required
    if (!deadline) {
      setOrganizerError("Please set a response deadline.");
      return;
    }
    // Deadline must be future
    if (Date.parse(deadline) <= Date.now()) {
      setOrganizerError("Deadline must be in the future.");
      return;
    }
    setDates((d) => {
      // Only keep the non-empty ones for simpler logic downstream
      const kept = d.map((x) => x.trim()).filter((x) => !!x);
      // Pre-fill extra slots if organizer entered fewer than 4
      return [...kept, ...Array(4 - kept.length).fill("")].slice(0, 4);
    });
    setPollCloseTime(Date.parse(deadline));
    setPhase("poll");
    // Reset prior polling state/results if re-submitting
    setMemberResponses(Array.from({ length: 12 }, () => Array(4).fill(null)));
    setCurrentMemberIdx(0);
    setResults(null);
    setDeadlineExpired(false);
  };

  // --- Handlers for member polling UI ---
  const handlePollResponse = (dateIdx, choice) => {
    setMemberResponses((prev) => {
      const copy = prev.map((arr) => [...arr]);
      copy[currentMemberIdx][dateIdx] = choice;
      return copy;
    });
  };
  const memberComplete = memberResponses[currentMemberIdx].every(Boolean);
  const handleNextMember = () => {
    if (!memberComplete) return;
    if (currentMemberIdx === defaultMembers.length - 1) {
      setCurrentMemberIdx(0);
    } else {
      setCurrentMemberIdx((i) => i + 1);
    }
  };

  // --- Emulate deadline expiry for demo ---
  const now = Date.now();
  React.useEffect(() => {
    if (phase === "poll" && pollCloseTime) {
      if (now >= pollCloseTime) {
        setDeadlineExpired(true);
        setPhase("results");
        computeResults();
      } else {
        // Poll for deadline
        const poller = setInterval(() => {
          if (Date.now() >= pollCloseTime) {
            setDeadlineExpired(true);
            setPhase("results");
            computeResults();
            clearInterval(poller);
          }
        }, 1200);
        return () => clearInterval(poller);
      }
    }
    // eslint-disable-next-line
  }, [phase, pollCloseTime]);

  // --- Manual "end poll early" for demo ---
  const endPollEarly = () => {
    setDeadlineExpired(true);
    setPhase("results");
    computeResults();
  };

  // --- Calculation: tally responses and determine best date(s) ---
  // For demo, "best date" = most YES, then most Tentative
  const computeResults = () => {
    // Only consider non-empty dates
    const activeDates = dates.filter((d) => !!d.trim());
    // Tally: [{yes: #, tentative: #, no: #}]
    const dateTallies = activeDates.map(() => ({
      yes: 0,
      tentative: 0,
      no: 0,
    }));
    memberResponses.forEach((row) => {
      row.forEach((cell, colIdx) => {
        if (colIdx < activeDates.length && cell) {
          dateTallies[colIdx][cell]++;
        }
      });
    });
    // Find best: most "yes", tiebreak by most "tentative"
    let bestScore = -1;
    let bestDates = [];
    dateTallies.forEach((t, idx) => {
      const score = t.yes * 2 + t.tentative; // Weight yes above tentative
      if (score > bestScore) {
        bestScore = score;
        bestDates = [idx];
      } else if (score === bestScore) {
        bestDates.push(idx);
      }
    });
    setResults({
      dateTallies,
      bestDates,
      activeDates,
    });
  };

  // --- UI Rendering Utilities ---
  const cardStyle = {
    background: colors.card,
    color: colors.text,
    borderRadius: "12px",
    boxShadow: `0 2px 14px 0 ${colors.shadow}`,
    margin: "30px auto",
    maxWidth: "650px",
    padding: "32px 28px 22px 28px",
    transition: "box-shadow 0.2s",
    border: `2px solid ${colors.primary}`,
    position: "relative",
  };
  const formLabel = {
    fontWeight: 500,
    marginBottom: 4,
    color: colors.primary,
    display: "block",
  };
  const input = {
    border: `1.5px solid ${colors.secondary}`,
    borderRadius: 5,
    fontSize: "1rem",
    padding: "8px 10px",
    width: "calc(100% - 22px)",
    marginBottom: "12px",
    background: "#f8f8ff",
  };
  const btn = {
    background: colors.primary,
    color: "#fff",
    fontWeight: 600,
    padding: "10px 24px",
    borderRadius: 6,
    border: "none",
    fontSize: "1rem",
    cursor: "pointer",
    margin: "12px 0",
    boxShadow: `0 1px 5px ${colors.shadow}`,
    letterSpacing: "0.01em",
    transition: "background 0.2s",
  };
  const dateCell = (text, isBest) => ({
    background: isBest ? colors.primary : "#f1f4ff",
    color: isBest ? "#fff" : colors.secondary,
    fontWeight: isBest ? 700 : 500,
    borderRadius: "7px",
    padding: "7px 8px",
    border: isBest ? `2px solid ${colors.accent}` : "1.5px solid #e0e5fb",
    transition: "background 0.15s",
    margin: "2px",
    minWidth: "118px",
    textAlign: "center",
    boxShadow: isBest ? `0 0 0 2px ${colors.accent}30` : undefined,
  });
  const chip = (label, color) => ({
    display: "inline-block",
    background: color,
    color: "#fff",
    borderRadius: "14px",
    fontSize: "0.95rem",
    fontWeight: 500,
    padding: "2px 12px",
    marginRight: "7px",
    marginBottom: "2px",
  });
  const pollBtn = (active, color) => ({
    ...btn,
    background: active ? color : "#fff",
    color: active ? "#fff" : color,
    border: `2px solid ${color}`,
    boxShadow: undefined,
    margin: 0,
    minWidth: 70,
  });

  // --- Main Content ---
  return (
    <div
      style={{
        background: colors.lightBg,
        minHeight: "100vh",
        paddingTop: 48,
        margin: 0,
      }}
    >
      <div style={{ ...cardStyle, marginTop: 52, marginBottom: 30 }}>
        <div
          style={{
            fontSize: "2.1rem",
            fontWeight: "bold",
            color: colors.primary,
            marginBottom: 6,
            letterSpacing: "0.03em",
          }}
        >
          PokerDateSync
        </div>
        <div style={{ color: colors.secondary, fontWeight: 500, fontSize: "1.04rem", marginBottom: 18 }}>
          <span role="img" aria-label="calendar">🃏</span>{" "}
          Schedule your monthly poker night with ease! Propose up to four dates, let members share availability, and let PokerDateSync pick the optimal day for all.
        </div>
      </div>

      {phase === "setup" && (
        <form onSubmit={handleSetupSubmit} style={{ ...cardStyle }}>
          <div style={{ fontSize: "1.22rem", fontWeight: 600, color: colors.secondary, marginBottom: 16 }}>
            Organizer: Enter up to 4 date options
          </div>
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} style={{ marginBottom: 7 }}>
              <label style={formLabel}>Date option {idx + 1}:</label>
              <input
                type="date"
                style={input}
                value={dates[idx]}
                onChange={(e) => handleDateChange(idx, e.target.value)}
                required={idx === 0}
                maxLength={20}
                disabled={false}
              />
            </div>
          ))}
          <div>
            <label style={formLabel}>Response Deadline:</label>
            <input
              type="datetime-local"
              style={input}
              value={deadline}
              onChange={handleDeadlineChange}
              min={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>
          {organizerError && (
            <div style={{ color: colors.accent, fontWeight: 600, marginTop: 5 }}>{organizerError}</div>
          )}
          <button type="submit" style={{ ...btn, marginTop: 14 }}>
            <span role="img" aria-label="card">📨</span> Send poll to members
          </button>
        </form>
      )}

      {phase === "poll" && (
        <div style={{ ...cardStyle }}>
          <div style={{ fontWeight: 700, fontSize: "1.18rem", color: colors.primary, marginBottom: 19 }}>
            Member Poll
          </div>
          <div style={{ color: colors.secondary, marginBottom: 9, fontWeight: 500 }}>
            Respond by:{" "}
            {new Date(deadline).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            <span style={{ marginLeft: 12, color: colors.accent }}>
              {deadlineExpired ? "Deadline passed" : ""}
            </span>
          </div>
          <div style={{ marginBottom: 9 }}>
            <span style={chip(defaultMembers[currentMemberIdx], colors.primary)} />
            <span style={{ fontStyle: "italic" }}>
              (Member {currentMemberIdx + 1} of {defaultMembers.length})
            </span>
          </div>
          <div style={{ overflowX: "auto", marginBottom: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "98%" }}>
              <thead>
                <tr>
                  <th style={{ ...formLabel, color: colors.secondary }}>&nbsp;</th>
                  {dates
                    .map((d, i) => d && (
                      <th key={i} style={dateCell(d, false)}>
                        {new Date(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, color: colors.secondary, paddingRight: 6 }}>Availability</td>
                  {dates
                    .map((d, i) =>
                      d
                        ? (
                          <td key={i}>
                            {["yes", "tentative", "no"].map((choice, j) => (
                              <button
                                key={choice}
                                style={pollBtn(
                                  memberResponses[currentMemberIdx][i] === choice,
                                  choice === "yes"
                                    ? colors.primary
                                    : choice === "tentative"
                                    ? colors.accent
                                    : "#bdbdbd"
                                )}
                                onClick={() => handlePollResponse(i, choice)}
                                type="button"
                                disabled={deadlineExpired}
                                tabIndex={0}
                              >
                                {choice === "yes"
                                  ? "Yes"
                                  : choice === "tentative"
                                  ? "Tentative"
                                  : "No"}
                              </button>
                            ))}
                          </td>
                        )
                        : null
                    )}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
            <button
              style={{
                ...btn,
                background: memberComplete ? colors.primary : "#e6e6e6",
                color: memberComplete ? "#fff" : "#aaa",
                minWidth: 120,
              }}
              onClick={handleNextMember}
              disabled={!memberComplete}
              type="button"
            >
              Save for {defaultMembers[currentMemberIdx]}
              {"  "}
              &raquo;
            </button>
            <button
              style={{
                ...btn,
                background: colors.accent,
                color: "#fff",
                minWidth: 110,
                marginLeft: 3,
              }}
              onClick={endPollEarly}
              type="button"
            >
              End Poll Early
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: "0.95rem", color: "#666" }}>
            Progress: {memberResponses.filter((r) => r.every(Boolean)).length} / {defaultMembers.length} responses recorded
          </div>
        </div>
      )}

      {phase === "results" && results && (
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: colors.accent, marginBottom: 9 }}>
            Best Date{results.bestDates.length > 1 ? "s" : ""}:
          </div>
          <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
            {results.bestDates.map((i) => (
              <div key={i} style={dateCell(results.activeDates[i], true)}>
                {new Date(results.activeDates[i]).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 11, fontWeight: 600, color: colors.primary, fontSize: "1.09rem" }}>
            Full Voting Results
          </div>

          <div style={{ overflowX: "auto", marginBottom: 6, marginTop: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...formLabel, color: colors.secondary, minWidth: 80 }}>Member</th>
                  {results.activeDates.map((d, j) => (
                    <th key={j} style={dateCell(d, results.bestDates.includes(j))}>
                      {new Date(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defaultMembers.map((name, mIdx) => (
                  <tr key={name}>
                    <td
                      style={{
                        padding: 4,
                        fontWeight: 500,
                        fontSize: "1rem",
                        color: colors.secondary,
                        background: "#fcfdff",
                        borderRadius: 8,
                      }}
                    >
                      {name}
                    </td>
                    {results.activeDates.map((_, dIdx) => {
                      const val = memberResponses[mIdx][dIdx];
                      return (
                        <td key={dIdx} style={{
                          padding: 3,
                          textAlign: "center",
                          background: "#f6f9ff",
                          borderRadius: 5,
                        }}>
                          {val === "yes" && <span style={chip("Yes", colors.primary)} />}
                          {val === "tentative" && <span style={chip("Tentative", colors.accent)} />}
                          {val === "no" && <span style={chip("No", "#888")} />}
                          {!val && <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "0.9em" }}>–</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Tally row */}
                <tr>
                  <td style={{ fontWeight: 600, color: colors.secondary, background: "#fff" }}>Total</td>
                  {results.dateTallies.map((res, j) => (
                    <td key={j} style={{
                      textAlign: "center",
                      background: "#f1f4fc",
                      borderRadius: 5,
                      fontWeight: 700,
                      fontSize: "1.01rem",
                    }}>
                      <span style={chip(`Yes: ${res.yes}`, colors.primary)} />
                      <span style={chip(`Tent: ${res.tentative}`, colors.accent)} />
                      <span style={chip(`No: ${res.no}`, "#888")} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 18 }}>
            <button
              style={{ ...btn, background: colors.primary, color: "#fff" }}
              onClick={() => {
                setPhase("setup");
                setDates(["", "", "", ""]);
                setDeadline("");
                setMemberResponses(Array.from({ length: 12 }, () => Array(4).fill(null)));
                setCurrentMemberIdx(0);
                setResults(null);
                setDeadlineExpired(false);
                setPollCloseTime(null);
              }}
              type="button"
            >
              Start New Poll
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PokerDateSync;
