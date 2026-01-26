import { useEffect, useState } from 'react'; // <--- Importar useState
import { useMemberStore } from '../stores/useMemberStore';
import { MemberCard } from '../components/MemberCard';
import { AddMemberModal } from '../components/AddMemberModal'; // <--- Importar Modal
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Search, Database, X } from 'lucide-react';
import { RenewModal } from '../components/RenewModal';
import { EditMemberModal } from '../components/EditMemberModal';


export default function MembersPage() {
  const { members, fetchMembers, isLoading, deleteMember } = useMemberStore();
  const [isModalOpen, setIsModalOpen] = useState(false); // <--- Estado del modal

  const [searchTermn, setSearchTerm] = useState(''); // Estado para el término de búsqueda  

  // Estado para el modal de renovación
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    MemberID: number;
    FullName: string;
    Phone: string;id: number, name: string
} | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);


  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Logica de filtrado (a implementar)
  const filteredMembers = members.filter(member => {
      const term = searchTermn.toLowerCase();
      const name = member.FullName.toLowerCase();
      const idMatch = member.MemberID.toString();
      return name.includes(term) || idMatch.includes(term);
  });

  // Manejar apertura del modal de renovación
  const handleOpenRenew = (member: any) => {
    setSelectedMember({
      MemberID: member.MemberID,
      FullName: member.FullName,
      Phone: member.Phone || '', // Proporciona un valor predeterminado si falta
      id: member.MemberID,
      name: member.FullName
    });
    setRenewModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    await deleteMember(id);
    // No necesitamos recargar manualmente porque el store actualiza la lista
  };
  // Función para abrir el modal
  const handleOpenEdit = (member: any) => {
    setSelectedMember({ 
        id: member.MemberID, // Nota: Asegúrate de pasar el objeto completo al modal o adaptar el state
        // Mejor truco: Guardamos el objeto completo 'member' en un state 'editingMember'
        ...member 
    });
    setEditModalOpen(true);
  };
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-[#27272a] pb-6">
        <div>
          <h2 className="text-3xl font-heading font-bold text-white mb-1">ATLETAS</h2>
          <p className="text-[#a1a1aa] font-mono text-sm">Gestión de membresías activas</p>
        </div>
        {/* El botón ahora abre el modal */}
        <Button className="bg-[#D4FF00] text-black font-extrabold hover:bg-[#b8dd00] hover:shadow-[0_0_20px_#D4FF00] transition-all" onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-5 w-5" /> Nuevo Atleta
        </Button>
      </div>

      {/* Barra de Búsqueda (Visual por ahora) */}
      <div className="flex gap-4 items-center bg-bg-[#18181b] p-4 rounded-xl border border-[#27272a]/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a1a1aa]" />
          <Input value={searchTermn} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nombre o ID..." className="pl-10 bg-bg border-[#27272a]" />
          {searchTermn && (
            <button onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="text-sm font-mono text-[#a1a1aa] hidden md:block">
            Resultados: <span className="text-[#D4FF00]">{filteredMembers.length}</span>
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
      <div className="text-[#D4FF00] font-mono animate-pulse">Cargando datos...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#a1a1aa] border border-dashed border-white/10 rounded-xl">
            <Database className="h-12 w-12 mb-4 opacity-20" />
            <p>No se encontraron atletas.</p>
            {searchTermn && <p className="text-xs mt-2">Prueba con otro nombre.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((member) => (
            <MemberCard 
              key={member.MemberID}
              memberId={member.MemberID} // Importante pasar ID
              name={member.FullName}
              plan={member.PlanName}
              daysLeft={member.DaysLeft}
              status={member.DaysLeft > 0 ? 'active' : 'expired'}
              // CONECTAMOS LAS ACCIONES
              onRenew={() => handleOpenRenew(member)}
              onDelete={() => handleDelete(member.MemberID)}
              onEdit={() => handleOpenEdit(member)}
            />
        ))}
        </div>
      )}

      {/* Renderizamos el Modal aquí */}
      <AddMemberModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
      
      <RenewModal 
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        memberId={selectedMember?.id || null}
        memberName={selectedMember?.name || ''}
      />

      <EditMemberModal 
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            member={selectedMember ? { // Adaptador simple
                MemberID: selectedMember.id || selectedMember.MemberID, 
                FullName: selectedMember.name || selectedMember.FullName,
                Phone: selectedMember.Phone || '' 
            } : null}
        />
    </div>
  );
}