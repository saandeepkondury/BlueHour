import { setSupplementPref } from "@/app/actions";
import { EVIDENCE_LABEL, SUPPLEMENTS } from "@/lib/nutrition/supplements";
import { getDisabledSupplements } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SupplementsPage() {
  const disabled = await getDisabledSupplements();

  return (
    <>
      <section className="sec" style={{ paddingTop: 0 }}>
        <p className="sec-intro">
          A short list on purpose. Each one only appears on the days it actually matters — and you can
          switch any of them off for good.
        </p>
      </section>

      {SUPPLEMENTS.map((supplement) => {
        const off = disabled.has(supplement.id);
        return (
          <article className="plaque" key={supplement.id}>
            <p className="plaque-kicker">
              {supplement.timing} · {EVIDENCE_LABEL[supplement.evidence]}
            </p>
            <h3 className="plaque-title" style={{ fontSize: "1.35rem" }}>
              {supplement.name}
            </h3>
            <p className="check-macros">{supplement.dose}</p>
            <p className="plaque-note">{supplement.purpose}</p>
            <form action={setSupplementPref} className="btn-row">
              <input type="hidden" name="id" value={supplement.id} />
              <input type="hidden" name="enabled" value={off ? "1" : "0"} />
              <button className={off ? "btn btn--gold btn--small" : "btn btn--ghost btn--small"} type="submit">
                {off ? "Turn back on" : "Not for me"}
              </button>
            </form>
          </article>
        );
      })}

      <p className="disclaimer">
        Nothing here is medical advice. If you are considering iron or anything ongoing, get bloodwork
        and talk to a doctor first.
      </p>
    </>
  );
}
