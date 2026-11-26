import FutsalLoader from "@/components/FutsalLoader";

/** Suspense fallback while a route chunk downloads. */
export default function RouteLoader() {
  return (
    <div className="relative z-10 flex min-h-[80vh] items-center justify-center">
      <FutsalLoader size={56} />
    </div>
  );
}
