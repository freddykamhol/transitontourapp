import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import AnfragenIndexPage from "./pages/anfragen/AnfragenIndexPage";
import AnfrageDetailsPage from "./pages/anfragen/AnfrageDetailsPage";
import VermietungenIndexPage from "./pages/rentals/VermietungenIndexPage";
import VermietungNeuPage from "./pages/rentals/VermietungNeuPage";
import VermietungDetailsPage from "./pages/rentals/VermietungDetailsPage";
import KalenderPage from "./pages/KalenderPage";
import EinstellungenPage from "./pages/EinstellungenPage";
import EinstellungenIntegrationenPage from "./pages/settings/EinstellungenIntegrationenPage";
import EinstellungenStatusPage from "./pages/settings/EinstellungenStatusPage";
import EinstellungenBenutzerPage from "./pages/settings/EinstellungenBenutzerPage";
import NotFoundPage from "./pages/NotFoundPage";
import FahrzeugeIndexPage from "./pages/vehicles/FahrzeugeIndexPage";
import FahrzeugNeuPage from "./pages/vehicles/FahrzeugNeuPage";
import FahrzeugDetailsPage from "./pages/vehicles/FahrzeugDetailsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="fahrzeug" element={<FahrzeugeIndexPage />} />
          <Route path="fahrzeug/neu" element={<FahrzeugNeuPage />} />
          <Route path="fahrzeug/:vehicleId" element={<FahrzeugDetailsPage />} />
          <Route path="anfragen" element={<AnfragenIndexPage />} />
          <Route path="anfragen/:id" element={<AnfrageDetailsPage />} />
          <Route path="vermietungen" element={<VermietungenIndexPage />} />
          <Route path="vermietungen/neu" element={<VermietungNeuPage />} />
          <Route path="vermietungen/:rentalId" element={<VermietungDetailsPage />} />
          <Route path="kalender" element={<KalenderPage />} />
          <Route path="einstellungen" element={<EinstellungenPage />}>
            <Route index element={<EinstellungenIntegrationenPage />} />
            <Route path="integrationen" element={<EinstellungenIntegrationenPage />} />
            <Route path="status" element={<EinstellungenStatusPage />} />
            <Route path="benutzer" element={<EinstellungenBenutzerPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
