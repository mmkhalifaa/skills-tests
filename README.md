# Coach Skill Router

An interactive demo of how the coach platform uses a skills framework to answer an advisor's question.

An advisor asks something like "My client wants to buy a $2.4M house. How should they fund it?" The coach:

1. **Routes** the question to a super skill (Funding & Liquidity) using trigger words and the amount.
2. **Loads one playbook** inside it (Buy a home, Buy a boat, Raise cash, Pay a tax bill) or an expert-written skill that is more specific (for example, Buy a home over $5M).
3. **Runs only the building blocks** that playbook lists (Check liquidity, Sell tax-smart, Borrow against portfolio, Compare mortgages, Pay taxes, Check plan impact).
4. **Calls the agents** those blocks need (Banking, Investment, Lending, Mortgage, Tax, Planning) for facts.
5. **Applies the guardrails** in the super skill, ranks the options, and returns an answer the advisor can use with the client.

The page also includes a **skill builder**. An expert sets when a skill applies, the checks to run first (agent, metric, limit, what to do if flagged) and the questions to raise with the client. It previews the skill as a `SKILL.md` and the coach routes matching questions to it. Saved skills are kept in the viewer's browser.

## Run it

Open `index.html` in a browser. It is a single self-contained file.

## Edit it

The page is built from the files in `src/`:

| File | What it holds |
| --- | --- |
| `head.html` | Title, fonts and all CSS |
| `body.html` | Page markup |
| `data.js` | Sample household, rates, agents, super skill, playbooks, building blocks, example questions |
| `engine.js` | Router, option builders, guardrails, ranking and the run trace |
| `custom.js` | Expert-skill checks (metrics), the example $5M+ home skill, saving to the browser |
| `ui.js` | Skill map, skill file panel, answer and run log |
| `builder.js` | Skill builder form and preview |

After editing, run `./build.sh` to regenerate `index.html`.

## Caveats

The household is made up, rates are placeholders rather than quotes, and tax uses federal rates only. It shows the pattern; it is not tax, legal or lending advice.
