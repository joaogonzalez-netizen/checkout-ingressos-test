// Textos padrão exibidos na página de vendas. Ficam editáveis em Configurações.
// PENDENTE: revisão jurídica antes de produção (rascunho baseado na Lei 12.933/2013, no CDC art. 49
// e no Decreto 7.962/2013).

export const DEFAULT_HALF_PRICE_TEXT = `Conforme a Lei Federal nº 12.933/2013 e as legislações estaduais e municipais aplicáveis, têm direito à meia-entrada, mediante apresentação de documento comprobatório válido:
- Estudantes regularmente matriculados, com Carteira de Identificação Estudantil (CIE) válida;
- Pessoas com 60 anos ou mais;
- Pessoas com deficiência (PcD) e, quando aplicável, 1 acompanhante;
- Jovens de 15 a 29 anos de famílias de baixa renda, inscritos no CadÚnico e com ID Jovem válida;
- Demais beneficiários previstos na legislação estadual ou municipal do local do evento.
A documentação é conferida na entrada. Se o benefício não for comprovado, será necessário pagar a diferença para o valor da inteira.`;

export const DEFAULT_CANCELLATION_TEXT = `Você pode cancelar a compra em até 7 dias após a compra (direito de arrependimento, art. 49 do Código de Defesa do Consumidor), desde que o pedido seja feito até 48 horas antes do início do evento. O valor é devolvido na mesma forma de pagamento. Para cancelar, fale com a gente pelos canais de atendimento desta página.`;

export const DEFAULT_FEE_TEXT = `A taxa de serviço (10% do valor do ingresso) cobre o processamento do pagamento, a emissão do ingresso digital com QR Code, o envio por e-mail e o atendimento ao comprador. Ela é mostrada separadamente antes do pagamento.`;

export const DEFAULT_ACCESS_RULES = `- O ingresso é válido somente para a data e o horário informados.
- Não será permitida a entrada após o início do espetáculo, salvo autorização da organização.
- Ao comprar, o participante declara estar ciente e de acordo com as regras de acesso e permanência no evento.
- A organização pode adotar medidas para garantir a segurança, o conforto do público e o bom andamento da apresentação.`;

export const AGE_RATINGS = [
  { value: "L", label: "Livre" },
  { value: "10", label: "10 anos" },
  { value: "12", label: "12 anos" },
  { value: "14", label: "14 anos" },
  { value: "16", label: "16 anos" },
  { value: "18", label: "18 anos" },
] as const;

export function ageRatingLabel(value: string | null | undefined) {
  if (!value) return null;
  return value === "L" ? "Livre" : `${value} anos`;
}
