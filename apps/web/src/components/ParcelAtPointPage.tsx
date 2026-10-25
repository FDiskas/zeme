import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resolveParcelByPoint } from "../lib/orpc";
import { ChevronLeft, Spinner } from "./icons";

type LookupState = "searching" | "not-found" | "error";

// /vieta?lat=…&lng=… — opens the report of the parcel under a point, e.g. the
// parcel a nearby school stands on. Replaces itself in history once resolved,
// so "Atgal" returns to the report the reader came from.
export function ParcelAtPointPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const validPoint = Number.isFinite(lat) && Number.isFinite(lng) && params.has("lat") && params.has("lng");
  const [state, setState] = useState<LookupState>("searching");

  useEffect(() => {
    if (!validPoint) return;
    let ignore = false;

    resolveParcelByPoint(lat, lng)
      .then((result) => {
        if (ignore) return;
        if (result) {
          navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`, { replace: true });
        } else {
          setState("not-found");
        }
      })
      .catch(() => {
        if (!ignore) setState("error");
      });

    return () => {
      ignore = true;
    };
  }, [lat, lng, validPoint, navigate]);

  const effectiveState: LookupState = validPoint ? state : "not-found";

  return (
    <main id="main" className="container grid gap-8 pt-8 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="link inline-flex w-fit cursor-pointer items-center gap-2 py-1 text-md no-underline hover:underline"
      >
        <ChevronLeft className="h-5 w-5" />
        Atgal
      </button>

      <div className="card flex flex-col items-start justify-center gap-6 p-10 md:p-16">
        {effectiveState === "searching" ? (
          <>
            <Spinner />
            <p className="text-lg text-ink-2">Ieškomas šios vietos sklypas…</p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl leading-tight font-bold tracking-display text-ink">
              {effectiveState === "not-found"
                ? "Šioje vietoje registruoto sklypo nerasta."
                : "Nepavyko surasti sklypo. Bandykite dar kartą vėliau."}
            </p>
            <Link
              to="/zemelapis"
              className="btn btn--secondary"
            >
              Ieškoti žemėlapyje
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
