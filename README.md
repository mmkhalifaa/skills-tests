# Coach Skill Router

An interactive demo of how the coach platform uses a skills framework to answer an advisor's question.

An advisor asks something like "My client wants to buy a $2.4M house. How should they fund it?" The coach:

1. **Routes** the question to a super skill (Funding & Liquidity) using trigger words and the amount.
2. **Loads one playbook** inside it (Buy a home, Buy a boat, Raise cash, Pay a tax bill) or an expert-written skill that is more specific (for example, Buy a home over $5M).
3. **Runs only the building blocks** that playbook lists (Check liquidity, Sell tax-smart, Borrow against portfolio, Compare mortgages, Pay taxes, Check plan impact).
4. **Calls the agents** those blocks need (Banking, Investment, Lending, Mortgage, Tax, Planning) for facts.
5. **Applies the guardrails** in the super skill, ranks the options, and returns an answer the advisor can use with the client.

The page also includes a **skill builder**. An expert sets when a skill applies, the checks to run first (agent, metric, limit, what to do if flagged) and the questions to raise with the client. It previews the skill as a `SKILL.md` and the coach routes matching questions to it. Saved skills are kept in the viewer's browser.

## Presentation mode

Select **Presentation mode** at the top of the page, or open the page with `#story` at the end of its address, for a simpler walkthrough to share. It covers each example (buy a home, buy a boat, raise cash, pay a tax bill, a $10M home with an expert skill) in six plain steps: the question, the skill it opens, what it checks, what the agents found, how the rules decide, and the answer. Use the arrow keys or the Back and Next buttons.

## Run it

Everything lives in one file, `index.html`: markup, styles, data, logic and the skill builder. Open it in a browser; there is nothing to install or build.

To change the sample household, rates, playbooks or agents, edit the data near the top of the `<script>` section in `index.html`.

## Caveats

The household is made up, rates are placeholders rather than quotes, and tax uses federal rates only. It shows the pattern; it is not tax, legal or lending advice.
