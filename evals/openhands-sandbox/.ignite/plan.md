# Plan

## Root cause
`calc.py` line 3: `return sum(numbers) / (len(numbers) + 1)`

## Change
Replace `len(numbers) + 1` with `len(numbers)` in the divisor

## Verification
Run `uv run --with pytest pytest -q` and confirm `test_average` passes