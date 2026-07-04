"""Static SCAMPER knowledge base.

SCAMPER is a checklist-based ideation method: seven "lenses" that transform an
existing product, service, or process into new solution candidates. Unlike the
TRIZ store there is nothing to embed or index — seven richly described lenses
are served verbatim and the calling LLM does the creative application.
"""

import random
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ScamperLens:
    id: int
    letter: str
    name: str
    description: str
    questions: list[str] = field(default_factory=list)
    examples: list[str] = field(default_factory=list)


LENSES: list[ScamperLens] = [
    ScamperLens(
        id=1,
        letter="S",
        name="Substitute",
        description=(
            "Replace a component, material, ingredient, person, process step, "
            "place, or rule with something else that performs the same function "
            "better, cheaper, safer, or more sustainably."
        ),
        questions=[
            "Which component, material, or ingredient could be replaced to improve the outcome?",
            "Can a different energy source, technology, or process step do the same job?",
            "Can another person, team, or supplier take over this part?",
            "What happens if we change the place, time, or channel where this happens?",
            "Which rule or assumption could be swapped for a different one?",
        ],
        examples=[
            "Soft drinks substituted sugar with sweeteners to create diet variants.",
            "Car makers substituted metal body parts with plastics and composites to cut weight.",
            "Retailers substituted cashiers with self-checkout kiosks.",
        ],
    ),
    ScamperLens(
        id=2,
        letter="C",
        name="Combine",
        description=(
            "Merge two or more components, functions, ideas, services, or process "
            "steps so the whole delivers more value than the parts, or so fewer "
            "steps and resources are needed."
        ),
        questions=[
            "Which two components or functions could be merged into one?",
            "Can two process steps be executed together or by the same resource?",
            "What product or service could ours be bundled with to create new value?",
            "Can we combine talents, teams, or data sources that today work apart?",
            "What would a hybrid of our solution and a competitor's look like?",
        ],
        examples=[
            "The smartphone combined a phone, camera, music player, and computer.",
            "2-in-1 shampoo combined washing and conditioning in one step.",
            "The clock radio combined an alarm clock with a radio receiver.",
        ],
    ),
    ScamperLens(
        id=3,
        letter="A",
        name="Adapt",
        description=(
            "Borrow and adjust a solution that already works elsewhere — in another "
            "industry, market, era, or in nature — and fit it to the current "
            "problem context."
        ),
        questions=[
            "What else looks like this problem, and how is it solved there?",
            "Which idea from another industry or market could be copied and adjusted?",
            "How does nature solve this kind of problem (biomimicry)?",
            "What did older or simpler solutions to this problem do well?",
            "What existing internal process could be repurposed as a template?",
        ],
        examples=[
            "Velcro adapted the hooks of burdock burrs into a fastener.",
            "Hospitals adapted Formula 1 pit-stop choreography to patient handovers.",
            "Drive-through banking adapted the fast-food service window.",
        ],
    ),
    ScamperLens(
        id=4,
        letter="M",
        name="Modify (Magnify / Minify)",
        description=(
            "Change an attribute of the solution — size, shape, frequency, "
            "strength, color, duration, tone — exaggerating it, shrinking it, or "
            "duplicating it until a new quality appears."
        ),
        questions=[
            "What could be made bigger, stronger, more frequent, or more prominent?",
            "What could be made smaller, lighter, shorter, or less frequent?",
            "Which attribute (shape, color, motion, sound, texture) could change?",
            "What feature could be exaggerated to become the main selling point?",
            "What could be duplicated or multiplied to add value?",
        ],
        examples=[
            "Concentrated laundry detergent minified the dose and packaging.",
            "Extra-large TV screens magnified an attribute into a product category.",
            "Travel-size toiletries created a new market by shrinking the format.",
        ],
    ),
    ScamperLens(
        id=5,
        letter="P",
        name="Put to another use",
        description=(
            "Use the product, process, by-product, or capability for a different "
            "purpose, a different user group, or a different market — as-is or "
            "with small changes."
        ),
        questions=[
            "What else could this be used for, exactly as it is today?",
            "Who else — other user groups, industries, markets — could use it?",
            "Can waste, scrap, or by-products be turned into something valuable?",
            "Could it serve a different purpose if slightly modified?",
            "Which existing capability or asset is underused and for what?",
        ],
        examples=[
            "Baking soda found a second life as a fridge deodorizer.",
            "Used shipping containers were put to another use as housing and offices.",
            "Sawdust from lumber mills is pressed into particleboard.",
        ],
    ),
    ScamperLens(
        id=6,
        letter="E",
        name="Eliminate",
        description=(
            "Remove components, features, steps, rules, or effort until only the "
            "essential function remains — simplification often reveals the "
            "breakthrough."
        ),
        questions=[
            "What can be removed without harming the core function?",
            "Which step of the process adds no value for the user?",
            "What would a radically simplified, stripped-down version look like?",
            "Which rule or requirement could be dropped entirely?",
            "What if we halved the parts, time, or cost — what must go?",
        ],
        examples=[
            "Cordless tools eliminated the power cord.",
            "Budget airlines eliminated free meals and seat assignment to cut fares.",
            "Touchscreen phones eliminated the physical keyboard.",
        ],
    ),
    ScamperLens(
        id=7,
        letter="R",
        name="Reverse / Rearrange",
        description=(
            "Invert, reorder, or transpose the components, sequence, roles, or "
            "logic — do the opposite of the obvious, start from the end, or swap "
            "cause and effect."
        ),
        questions=[
            "What if we reversed the order of the steps or started from the end?",
            "What would doing the exact opposite of the current approach look like?",
            "Can components, layout, or schedule be rearranged?",
            "Can roles be swapped — the user does what we do, or vice versa?",
            "Can cause and effect, input and output, be interchanged?",
        ],
        examples=[
            "IKEA reversed assembly: customers build the furniture themselves.",
            "Reverse vending machines pay users for returning empties.",
            "Pay-what-you-want pricing reversed who sets the price.",
        ],
    ),
]

_BY_KEY: dict[str, ScamperLens] = {}
for _lens in LENSES:
    _BY_KEY[str(_lens.id)] = _lens
    _BY_KEY[_lens.letter.lower()] = _lens
    _BY_KEY[_lens.name.lower()] = _lens

# Common aliases for lens lookup by name fragment.
_ALIASES = {
    "modify": "m",
    "magnify": "m",
    "minify": "m",
    "put to other use": "p",
    "put to another use": "p",
    "repurpose": "p",
    "reverse": "r",
    "rearrange": "r",
    "invert": "r",
}


def get_lenses() -> list[ScamperLens]:
    return LENSES


def find_lens(key: str) -> ScamperLens | None:
    normalized = key.strip().lower()
    if not normalized:
        return None
    if normalized in _ALIASES:
        normalized = _ALIASES[normalized]
    if normalized in _BY_KEY:
        return _BY_KEY[normalized]
    return next((lens for lens in LENSES if normalized in lens.name.lower()), None)


def random_questions(count: int) -> list[tuple[ScamperLens, str]]:
    pool = [(lens, question) for lens in LENSES for question in lens.questions]
    return random.sample(pool, k=min(count, len(pool)))
