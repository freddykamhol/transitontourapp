import { useNavigate } from "react-router-dom";
import RentalForm from "./components/RentalForm";
import { createRental, updateRental } from "../../storage/rentalRepo";
import { sendRentalDocumentsMail } from "./rentalMail";

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
        onSubmit={async (value) => {
          const rental = createRental(value);
          try {
            const result = await sendRentalDocumentsMail(rental);
            updateRental(rental.id, {
              contractWorkflow: {
                ...rental.contractWorkflow,
                lastSentAt: new Date().toISOString(),
                lastMessageId: result.messageId,
                lastError: "",
              },
            });
          } catch (err) {
            updateRental(rental.id, {
              contractWorkflow: {
                ...rental.contractWorkflow,
                lastError: err instanceof Error ? err.message : "Versand fehlgeschlagen",
              },
            });
          }
          navigate(`/vermietungen/${encodeURIComponent(rental.id)}`);
        }}
      />
    </div>
  );
}
