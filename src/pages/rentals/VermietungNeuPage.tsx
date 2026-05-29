import { useNavigate } from "react-router-dom";
import RentalForm from "./components/RentalForm";
import { createRental } from "../../storage/rentalRepo";

export default function VermietungNeuPage() {
  const navigate = useNavigate();

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Vermietung anlegen</h2>
        <p className="mt-1 text-xs text-slate-500">Grundaufbau: Termine, Mieter, Fahrzeug, Zusatzfahrer, Versicherung, Zusatzleistungen, Zahlung.</p>
      </section>

      <RentalForm
        mode="create"
        submitLabel="Vermietung speichern"
        onCancel={() => navigate("/vermietungen")}
        onSubmit={(value) => {
          const rental = createRental(value);
          navigate(`/vermietungen/${encodeURIComponent(rental.id)}`);
        }}
      />
    </div>
  );
}

