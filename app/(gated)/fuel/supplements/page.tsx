import { setSupplementPref } from "@/app/actions";
import { EVIDENCE_LABEL, SUPPLEMENTS, type Evidence } from "@/lib/nutrition/supplements";
import { getDisabledSupplements } from "@/lib/store";

export const dynamic = "force-dynamic";

const EVIDENCE_PILL: Record<Evidence, string> = {
  solid: "pill pill--good",
  situational: "pill pill--accent",
  thin: "pill",
};

export default async function SupplementsPage() {
  const disabled = await getDisabledSupplements();
  const on = SUPPLEMENTS.filter((supplement) => !disabled.has(supplement.id)).length;

  return (
    <>
      <section className="block block--tight">
        <div className="row-between">
          <p className="label">On your list</p>
          <span className="pill pill--accent">
            {on} of {SUPPLEMENTS.length}
          </span>
        </div>
      </section>

      <section className="block block--tight">
        <div className="stack">
          {SUPPLEMENTS.map((supplement) => {
            const off = disabled.has(supplement.id);
            return (
              <div className={off ? "card card--sunk" : "card"} key={supplement.id}>
                <div className="card__head">
                  <div>
                    <h3 className="card__title">{supplement.name}</h3>
                    <p className="card__sub">
                      {supplement.dose} · {supplement.timing}
                    </p>
                  </div>
                  <span className={EVIDENCE_PILL[supplement.evidence]}>
                    {EVIDENCE_LABEL[supplement.evidence]}
                  </span>
                </div>

                <details className="fold" style={{ marginTop: "0.5rem" }}>
                  <summary>What it is for</summary>
                  <div className="fold__body">
                    <p className="small sub">{supplement.purpose}</p>
                  </div>
                </details>

                <form action={setSupplementPref} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="id" value={supplement.id} />
                  <input type="hidden" name="enabled" value={off ? "1" : "0"} />
                  <button
                    className={off ? "btn btn--ghost btn--sm" : "btn btn--quiet btn--sm"}
                    type="submit"
                  >
                    {off ? "Add back" : "Not for me"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        <p className="fineprint">
          Not medical advice. For iron or anything ongoing, get bloodwork and talk to a doctor first.
        </p>
      </section>
    </>
  );
}
