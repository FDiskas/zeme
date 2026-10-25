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
    <main className="mx-auto grid w-full max-w-shell gap-6 px-4 py-8 md:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg py-1 text-lg font-semibold text-forest-700 transition-colors hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
      >
        <ChevronLeft className="h-5 w-5" />
        Atgal
      </button>

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-mist-200 bg-white p-12 text-center">
        {effectiveState === "searching" ? (
          <>
            <Spinner />
            <p className="text-xl text-mist-700">Ieškomas šios vietos sklypas…</p>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-mist-900">
              {effectiveState === "not-found"
                ? "Šioje vietoje registruoto sklypo nerasta."
                : "Nepavyko surasti sklypo. Bandykite dar kartą vėliau."}
            </p>
            <Link
              to="/zemelapis"
              className="rounded-sm text-lg font-semibold text-forest-700 underline decoration-forest-300 underline-offset-4 transition-colors hover:text-forest-900 hover:decoration-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
            >
              Ieškoti žemėlapyje
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
