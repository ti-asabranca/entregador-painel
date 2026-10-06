import { Link, useParams } from 'react-router-dom';
import { DetalheMotorista } from '../componentes/DetalheMotorista';

export function MotoristaPagina() {
  const { codigo = '' } = useParams();
  return (
    <main className="pagina pagina-motorista">
      <Link to="/entregadores" className="voltar">← Entregadores</Link>
      {/^\d{6}$/.test(codigo)
        ? <DetalheMotorista key={codigo} codigo={codigo} />
        : <div className="aviso erro">Código de motorista inválido.</div>}
    </main>
  );
}
