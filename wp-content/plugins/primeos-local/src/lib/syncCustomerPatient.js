import { primeos } from "@/api/primeosClient";


/**
 * Garante que todo Customer criado no CRM tenha um PatientRecord vinculado,
 * evitando duplicidade de dados entre CRM, Agenda e Prontuários.
 *
 * Regras:
 * 1. Se já existe PatientRecord com patient_id === customer.id, não faz nada.
 * 2. Se existe PatientRecord com mesmo nome/telefone (sem patient_id), vincula
 *    atualizando patient_id para customer.id (evita duplicar).
 * 3. Caso contrário, cria um PatientRecord mínimo com os dados do Customer.
 *
 * Retorna o PatientRecord vinculado (existente ou criado) ou null em caso de erro.
 */
export async function syncCustomerToPatientRecord(customer) {
  if (!customer?.id || !customer?.name) return null;

  try {
    // 1. Já vinculado?
    const linked = await primeos.entities.PatientRecord.filter({
      patient_id: customer.id
    });
    if (linked && linked.length > 0) return linked[0];

    // 2. Possível duplicata por nome/telefone sem patient_id
    const byName = await primeos.entities.PatientRecord.filter({
      patient_name: customer.name
    });
    const match = (byName || []).find(
      (pr) =>
        (customer.phone && pr.patient_phone === customer.phone) ||
        !pr.patient_id
    );

    if (match) {
      return await primeos.entities.PatientRecord.update(match.id, {
        patient_id: customer.id,
        patient_phone: match.patient_phone || customer.phone || null,
        patient_email: match.patient_email || customer.email || null,
      });
    }

    // 3. Cria novo PatientRecord
    return await primeos.entities.PatientRecord.create({
      patient_id: customer.id,
      patient_name: customer.name,
      patient_phone: customer.phone || null,
      patient_email: customer.email || null,
      status: "active",
      treatment_status: "em_avaliacao",
      notes: "Criado automaticamente a partir do CRM (Customer)."
    });
  } catch (error) {
    console.error("Erro ao sincronizar Customer -> PatientRecord:", error);
    return null;
  }
}

export default syncCustomerToPatientRecord;
