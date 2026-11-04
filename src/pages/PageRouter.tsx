import { useNavigation } from "../hooks/useNavigation";
import type { PageProps } from "./pageTypes";
import { InicioPage } from "./InicioPage";
import { BuscarPage } from "./BuscarPage";
import { BibliotecaPage } from "./BibliotecaPage";
import { EstadisticasPage } from "./EstadisticasPage";
import { ConfiguracionPage } from "./ConfiguracionPage";
import { ReproduciendoPage } from "./ReproduciendoPage";

export function PageRouter({ controls }: PageProps) {
  const { route } = useNavigation();

  switch (route) {
    case "buscar":
      return <BuscarPage controls={controls} />;
    case "biblioteca":
      return <BibliotecaPage controls={controls} />;
    case "estadisticas":
      return <EstadisticasPage controls={controls} />;
    case "configuracion":
      return <ConfiguracionPage controls={controls} />;
    case "reproduciendo":
      return <ReproduciendoPage controls={controls} />;
    default:
      return <InicioPage controls={controls} />;
  }
}
