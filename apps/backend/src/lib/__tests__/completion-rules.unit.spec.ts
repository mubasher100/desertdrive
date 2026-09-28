import { CARD_PROVIDER, completionProblem } from "../completion-rules"
import { testProof } from "../test-proof"

/**
 * The gate every order passes. Both rules were holes on the live site before
 * this existed — an unpaid booking of any vehicle, and a real 1 QAR booking —
 * each one a hand-written call to Medusa's public Store API away.
 */
const card = [CARD_PROVIDER]
const KEY = "owner-secret"

describe("completionProblem", () => {
  it("lets an ordinary card booking through", () => {
    expect(completionProblem({ providers: card, holdsTestVehicle: false, proof: undefined, key: KEY })).toBeNull()
  })

  it("refuses the old cash provider — cash was removed, and it took no money", () => {
    expect(completionProblem({ providers: ["pp_system_default"], holdsTestVehicle: false, proof: undefined, key: KEY })).toBe("not-card")
  })

  it("refuses a card session sitting beside a non-card one", () => {
    expect(completionProblem({ providers: [CARD_PROVIDER, "pp_system_default"], holdsTestVehicle: false, proof: undefined, key: KEY })).toBe("not-card")
  })

  it("refuses the test vehicle with no proof", () => {
    expect(completionProblem({ providers: card, holdsTestVehicle: true, proof: undefined, key: KEY })).toBe("test-without-key")
  })

  it("refuses the test vehicle with the wrong proof", () => {
    expect(completionProblem({ providers: card, holdsTestVehicle: true, proof: testProof("guess"), key: KEY })).toBe("test-without-key")
  })

  /** A proof is a hash; sending the raw key must not work either. */
  it("refuses the raw key in place of the proof", () => {
    expect(completionProblem({ providers: card, holdsTestVehicle: true, proof: KEY, key: KEY })).toBe("test-without-key")
  })

  it("fails closed when no key is configured, even with a proof", () => {
    expect(completionProblem({ providers: card, holdsTestVehicle: true, proof: testProof(""), key: undefined })).toBe("test-without-key")
    expect(completionProblem({ providers: card, holdsTestVehicle: true, proof: testProof(""), key: "" })).toBe("test-without-key")
  })

  it("lets the owner's own test booking through", () => {
    expect(completionProblem({ providers: card, holdsTestVehicle: true, proof: testProof(KEY), key: KEY })).toBeNull()
  })
})
