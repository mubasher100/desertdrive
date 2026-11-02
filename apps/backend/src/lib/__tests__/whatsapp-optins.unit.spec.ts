import { optInsCsv, optInsFromOrders } from "../whatsapp-optins"

const order = (display_id: number, metadata: Record<string, unknown>) => ({
  display_id,
  created_at: "2026-11-01T10:00:00.000Z",
  metadata,
})

describe("optInsFromOrders", () => {
  it("keeps only an explicit true", () => {
    const rows = optInsFromOrders([
      order(1, { whatsapp_offers: true, contact_phone: "+97455551234", contact_name: "A" }),
      order(2, { whatsapp_offers: false, contact_phone: "+97455550000" }),
      order(3, { whatsapp_offers: "true", contact_phone: "+97455550001" }),
      order(4, { contact_phone: "+97455550002" }),
    ])
    expect(rows.map((r) => r.reference)).toEqual(["DD-1"])
  })

  it("lists a repeat customer once, with their latest opt-in", () => {
    const rows = optInsFromOrders([
      order(1, { whatsapp_offers: true, contact_phone: "+97455551234", whatsapp_offers_at: "2026-11-01T00:00:00.000Z" }),
      order(2, { whatsapp_offers: true, contact_phone: "+97455551234", whatsapp_offers_at: "2026-11-02T00:00:00.000Z" }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].reference).toBe("DD-2")
  })

  it("skips an opt-in with no number to message", () => {
    expect(optInsFromOrders([order(1, { whatsapp_offers: true })])).toEqual([])
  })
})

describe("optInsCsv", () => {
  it("never lets a cell run as a spreadsheet formula", () => {
    const csv = optInsCsv([
      { name: "=HYPERLINK(\"http://x\")", phone: "+97455551234", email: "a@b.qa", reference: "DD-1", opted_in_at: "2026-11-02" },
    ])
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m)
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(csv).toContain("'+97455551234")
  })

  it("starts with a BOM so Arabic names open correctly in Excel", () => {
    expect(optInsCsv([]).charCodeAt(0)).toBe(0xfeff)
  })
})
