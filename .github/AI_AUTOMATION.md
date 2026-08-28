# AI Automation

GitHub Issue-driven coding pipeline.

## Trigger
Add the `ai:auto` label to an open issue created by the repository owner.

## Architecture

The Issue-triggered workflow is intentionally installed on the repository default branch (`main`) because GitHub evaluates `issues` event workflows from the default branch.

Implementation work is performed from `develop` and AI pull requests target `develop`.

## Pipeline
Planner → Developer → Independent Reviewer → Tester → Fix loops → Pull Request

The automation runs on the trusted `ai-engineer` self-hosted runner.

Human merge is always required.
