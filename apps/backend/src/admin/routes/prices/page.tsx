import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import { Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/client"
import "../../lib/simplify"

type PriceRow = {
  code: string
  name: string
  kind: "area" | "band"
  prices: Record<string, number | null>
}
type PriceTable = { classes: ReadonlyArray<{ handle: string; title: string }>; rows: PriceRow[] }

/** Stored riyals → the whole dollars the owner edits. 61.88 QAR is $17. */
const toUsd = (qar: number | null) => (qar == null ? "" : String(Math.round((qar / 3.64) * 100) / 100))

/**
 * Every fare on one page: each area and distance band, each car, in whole US
 * dollars — the currency the site shows customers. Saving converts to the
 * exact riyal amount the card is charged (×3.64), on the server.
 *
 * Built for a phone: one card per area, the five prices two to a row. A new
 * price is live on the site within the cache window — no deploy.
 */
const PricesPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["price-table"],
    queryFn: () => sdk.client.fetch<PriceTable>("/admin/price-table"),
  })

  return (
    <div className="flex flex-col gap-3">
      <Container className="flex flex-col gap-1 px-4 py-4 small:px-6">
        <Heading level="h1">Prices</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          One-way fare from or to the airport, in US dollars. The card is charged the riyal equivalent (×3.64). Change a
          price and press Save — it is live on the site within a few minutes.
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Areas are checked first; anywhere outside them uses its distance band.{" "}
          <Link to="/zones" className="text-ui-fg-interactive hover:underline">Edit area outlines on the map</Link>
        </Text>
      </Container>

      {isLoading || !data ? (
        <Container className="px-4 py-8 small:px-6">
          <Text size="small" className="text-ui-fg-subtle">Loading prices…</Text>
        </Container>
      ) : (
        data.rows.map((row) => <PriceCard key={row.code} row={row} classes={data.classes} />)
      )}
    </div>
  )
}

function PriceCard({ row, classes }: { row: PriceRow; classes: PriceTable["classes"] }) {
  const queryClient = useQueryClient()
  const original = Object.fromEntries(classes.map((c) => [c.handle, toUsd(row.prices[c.handle])]))
  const [values, setValues] = useState<Record<string, string>>(original)

  const changed = classes.filter((c) => values[c.handle] !== original[c.handle])
  const invalid = changed.some((c) => !/^\d+$/.test(values[c.handle]) || Number(values[c.handle]) < 1)

  const save = useMutation({
    mutationFn: async () => {
      // One price at a time: each is its own small workflow.
      for (const c of changed) {
        await sdk.client.fetch("/admin/price-table", {
          method: "POST",
          body: { code: row.code, handle: c.handle, usd: Number(values[c.handle]) },
        })
      }
    },
    onSuccess: () => {
      toast.success(`${row.name}: prices saved`)
      queryClient.invalidateQueries({ queryKey: ["price-table"] })
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  })

  return (
    <Container className="flex flex-col gap-3 px-4 py-4 small:px-6">
      <div>
        <Text size="base" weight="plus" leading="compact">{row.name}</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">{row.kind === "area" ? "Area" : "Distance band"}</Text>
      </div>
      <div className="grid grid-cols-2 gap-3 small:grid-cols-5">
        {classes.map((c) => {
          const v = values[c.handle]
          const qar = /^\d+$/.test(v) ? Math.round(Number(v) * 3.64 * 100) / 100 : null
          return (
            <label key={c.handle} className="flex flex-col gap-1">
              <Text size="small" weight="plus">{c.title}</Text>
              <div className="flex items-center gap-1">
                <Text size="small" className="text-ui-fg-subtle">$</Text>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={v}
                  placeholder="not sold"
                  onChange={(e) => setValues((s) => ({ ...s, [c.handle]: e.target.value }))}
                  className="min-h-[44px]"
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">{qar != null ? `${qar} QAR` : "not sold here"}</Text>
            </label>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 xsmall:flex-row xsmall:justify-end">
        {changed.length > 0 && (
          <Button size="small" variant="secondary" className="min-h-[44px] w-full xsmall:w-auto" onClick={() => setValues(original)} disabled={save.isPending}>
            Undo
          </Button>
        )}
        <Button
          size="small"
          className="min-h-[44px] w-full xsmall:w-auto"
          disabled={changed.length === 0 || invalid || save.isPending}
          isLoading={save.isPending}
          onClick={() => save.mutate()}
        >
          {invalid ? "Whole dollars only" : changed.length ? `Save ${changed.length} price${changed.length === 1 ? "" : "s"}` : "Save"}
        </Button>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Prices",
  icon: CurrencyDollar,
})

export default PricesPage
