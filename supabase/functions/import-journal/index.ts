import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UID = '2bcc2034-fc1b-4d99-be21-f3362388fb35';

// Account reference → UUID
const A: Record<string, string> = {
  C1:'af530ab1-475a-4e3f-bc91-6ceb9d6defc4',C2:'d49e0d3c-859e-4d63-b3e5-75d3c773adbb',
  C3:'8e39ee20-e964-4bed-9225-0d99186c5c45',C4:'670bdc8f-6b27-4747-8149-1bc6e1f378bd',
  C5:'35ff7436-3e9f-4d06-bae2-e8141a372fcd',C6:'531e08f4-71e6-4c26-a2d1-6174f48393e0',
  C7:'043bd34c-adca-40db-ad7a-049d8e2a13be',C8:'d10c9965-363e-444a-96b8-86ca64ba3882',
  C9:'f3afdef3-6a30-4da4-8541-6aedcbd41e1b',C10:'1ddffb6b-08c8-4fff-8628-d7e5a34c759a',
  C11:'eea890a6-1953-4a1f-9667-516ad4fb8683',C12:'33c8921b-8e02-473a-a9ff-947d14125885',
  C13:'3491bd5b-910a-48c5-a542-de8b73565681',C14:'e6dafb6e-205a-46bf-99be-35127700ad22',
  C15:'34a7b03b-5cc6-469a-9055-5872ef71a7aa',C16:'2525ecea-f2fa-417a-9f57-106931fdb459',
  C17:'e8b61307-ba8b-4b2f-a552-b39e74bf0566',C18:'f9b9769d-2e59-4b08-bb1c-d785c25ecc4c',
  C19:'2ef09464-d415-4a43-ab77-eba363b16de2',C20:'44ff9766-4856-4032-bb52-9a8ad005e664',
  C21:'d4478395-4393-45b5-8431-caa92224571f',C22:'552889b4-a000-4187-9729-7d0b78f09535',
  C23:'545d8707-c7bb-46ec-9c22-9e6d9912ca9d',C24:'30c68140-ddff-4e0d-881b-9bd636c1694f',
  C25:'2839a7da-f997-427d-8549-e4570c4c6c93',C26:'d4cf1a80-3b66-4a88-9293-0d39ec1e6d74',
  C27:'4a7861ce-dd0f-441f-8000-4690f0b57099',C28:'987b8ac1-d849-4311-a49b-97ffb941a4fb',
  C29:'a5200978-77b8-4d3a-90e8-85d701aaa4a4',C30:'d897a7f5-0f14-4615-a362-177c5ecbc244',
  C31:'3b1f5875-5b37-4bc5-8262-ae07596345ab',C32:'8361dd4b-58eb-4241-8488-b97e6af0d832',
  C33:'29c80b3a-81a6-4652-9389-e2049650dbae',C34:'7c1596f1-f928-41f1-99c5-cf1dcfd51239',
  C35:'271f6799-80fe-48b2-b7fe-11d842fbebe2',C36:'3467ff95-375c-4217-accb-0feb29537aff',
  C37:'9dc801ee-dc1a-4583-b9f0-3638c1127c91',C38:'276820e5-44c0-4b81-8a5f-df2cbaa93b21',
};

// Category reference → UUID
const CAT: Record<string, string> = {
  R2:'1f0e2769-6e65-43f5-992a-86e4ea82942d',R3:'85816be9-1ab2-4059-8dc0-eb970cd6b588',
  R7:'5b436427-658b-4127-9700-a90a6ff892e6',R8:'ac5d003b-9c7b-4618-82a9-6d817a61c2f6',
  R9:'b20c11f8-6105-4fca-8575-a36dc16b30de',R10:'78d11cce-3271-4750-ac38-76a164c346d9',
  R13:'517fa4e8-e369-4537-b116-5286adbc1b47',R14:'f635c537-6a36-4173-8fa1-ef901a15a883',
  R15:'d4f0301b-e2d6-4414-b150-0b8158ff8af9',R17:'a62bfb1c-af8f-4007-9157-9387d1ae340c',
  D2:'38d2a6d6-79d4-4b32-95b0-98b9f5890a81',D8:'12c4de03-35e8-44fb-9a14-5a0462ee15fa',
  D9:'e0974d7b-72ee-4496-8804-9e950556b6a2',D11:'e412abcf-5921-4aaf-88ef-d4e53e061dd4',
  D14:'7bf59542-7b6b-4909-be4f-5603654a27f8',D16:'c215834f-a3a8-42ff-b2d7-963297964058',
  D18:'76e3d971-8a24-464c-b526-8e2ed76e6f62',D19:'f3093296-de5b-4da1-9b73-189ef2f0bee6',
  D20:'59b7ab29-1a62-48ea-b793-b4525c4b5604',D21:'9c4ac5e1-72a3-4f6f-862e-2dc58905ed65',
  D22:'2286dbf3-5805-4fed-9aa8-61f4651f75b0',D23:'57521c42-cf8b-44e7-a3b1-69cf15cea9c5',
  D24:'59aa4654-8912-4d0d-926a-d8a5bce12324',D25:'b7867bbc-6bc6-4e2e-bd03-3668c6e55a80',
  D27:'5d489a30-2a60-45b7-b490-096f677a5e5c',D28:'8626ba80-c59a-44d8-9972-53064c1f3f40',
  D29:'6d051b68-15ad-4379-b923-f292a7b84f33',D30:'1b34dc32-f340-4097-a7f6-a49c1033b15b',
  D31:'8a5f102e-71fd-46ec-a140-6bbb7e771c83',D32:'8854af16-562f-47c6-9b92-d1c1c2edf17a',
  D33:'1619d478-7ab1-4fd6-8e12-cb11dbaa9889',D36:'9a082121-6d10-48c3-8d9c-dd8121d82d81',
  D37:'e9fb6b52-de4f-4903-bd10-295cbb827b1d',D38:'c9813670-3af3-4ced-82eb-3e119f36539f',
  D44:'ad07e2d3-53cc-4bf5-a3d9-beddc8629a4b',D45:'4b9ee4ca-167e-494d-82ef-29b64c65499d',
  D47:'9669f7ad-f877-4e73-8eae-d35a97c4fd7d',D48:'fa7b0954-a19e-4ae1-b249-7d2b125134d7',
  D51:'754efc89-4267-4502-9233-1f6ed44e94cc',D52:'36d2e2a6-00e0-4257-8889-fd56028c8861',
  D54:'6d64f9f0-bee4-4c98-8d24-268304ff3914',D55:'7679c217-7a34-4637-b5f1-5c7d3de5ca0e',
  D57:'ee385f52-a713-4e6a-98bc-3705589ec7e4',D58:'7690de13-0347-419e-bdc7-21fb6c80f06b',
  D59:'21fe5d9c-b647-4a4d-8f5a-6dd58e8e8195',D60:'1f287dae-2d8f-4eac-bc5f-1cb862db5dee',
};

// Each row: [ref, date(YYYY-MM-DD), aug, dim, contrepartieRef, description, notes]
// ref starts with R=revenue category, D=expense category, C=account (transfer/savings dest)
const ROWS: [string,string,number,number,string,string,string][] = [
  // === JANUARY ===
  // Transfers
  ["C13","2026-01-01",20000,20000,"C1","Retrait SGCI - CAG",""],
  ["C5","2026-01-01",20000,20000,"C13","Dépôt OM CAG",""],
  // Revenue: R8 Réception argent KKJAG → C13
  ["R8","2026-01-01",10000,0,"C13","Réception argent KKJAG",""],
  // Expense
  ["D44","2026-01-01",1500,1500,"C13","Achat de plaquette en bois pour le toit de la chambre",""],
  // Revenue: R8 → C13
  ["R8","2026-01-01",1000,0,"C13","Réception argent KKJAG",""],
  // Expenses
  ["D16","2026-01-01",20000,20000,"C5","Paiement Internet Wifi Maison",""],
  ["D38","2026-01-01",100,100,"C5","Frais de dépôt OM",""],
  // Revenue: R9 → C17
  ["R9","2026-01-01",25000,0,"C17","Rechargement unité pro",""],
  // Expense
  ["D47","2026-01-01",24451,24451,"C17","Régularisation crédit pro",""],
  // Revenue: R7 → C22
  ["R7","2026-01-01",27,0,"C22","Intérêts Orange Bank",""],
  // Revenue: R7 → C2
  ["R7","2026-01-01",1349,0,"C2","Intérêts compte épargne SGCI / C2",""],
  // Revenue: R7 → C31
  ["R7","2026-01-01",15838,0,"C31","Intérêts compte épargne SGCI CréditMatic / C31",""],
  // Revenue: R7 → C33
  ["R7","2026-01-01",3670,0,"C33","Intérêts compte épargne SGCI CréditMatic / C33",""],
  // Revenue: R7 → C27
  ["R7","2026-01-01",755,0,"C27","Intérêts CORIS BANK",""],
  // Expenses Jan 2
  ["D21","2026-01-02",10000,10000,"C13","Carburant - NCI",""],
  ["D44","2026-01-02",100,100,"C13","Remise argent à KKJAG pour completer Garba",""],
  // Revenue: R8 → C13 Jan 4
  ["R8","2026-01-04",2300,0,"C13","Réception argent KKJAG",""],
  ["D28","2026-01-04",300,300,"C13","Paiement vérification pression PNEU - Tucson",""],
  ["D22","2026-01-04",2000,2000,"C13","Lavage Auto ce jour",""],
  // Revenue: R8 → C13 Jan 3
  ["R8","2026-01-03",1000,0,"C13","Réception argent KKJAG",""],
  ["D32","2026-01-03",1000,1000,"C13","Achat de sucrerie orangina",""],
  // Transfer + expenses Jan 5
  ["C13","2026-01-05",20000,20000,"C1","Retrait SGCI - CAG",""],
  ["D21","2026-01-05",12000,12000,"C13","Carburant - NCI",""],
  ["D31","2026-01-05",2000,2000,"C6","Achat de riz aux légumes",""],
  // Revenue: R8 → C6 Jan 5
  ["R8","2026-01-05",5000,0,"C6","Réception argent AET B par Stéphane Diongo",""],
  // Expenses Jan 6
  ["D31","2026-01-06",2000,2000,"C13","Nourriture de midi - Riz avec Sauce arachide + pondeuse",""],
  ["D32","2026-01-06",1000,1000,"C13","Achat de sucrerie - Coca cola",""],
  ["D29","2026-01-06",1000,1000,"C13","Paiement Réparation chaussure (Souliers) CAG",""],
  // Revenue: R14 → C5 Jan 6
  ["R14","2026-01-06",50500,0,"C5","Réception avance sur Modification / Expertise Excel - GIZ",""],
  // Expenses Jan 7
  ["D31","2026-01-07",1500,1500,"C6","Achat d'Alloco Poulet / Cantine NCI",""],
  ["D44","2026-01-07",10000,10000,"C5","Dépôt OM à Richards (Contact de Daniel N'Latte)",""],
  ["D38","2026-01-07",100,100,"C5","Frais de dépôt OM à Richards",""],
  // Expenses Jan 8
  ["D44","2026-01-08",30000,30000,"C5","Dépôt OM à Bohe pour permis militaire",""],
  ["D38","2026-01-08",300,300,"C5","Frais de dépôt OM",""],
  ["D31","2026-01-08",1500,1500,"C6","Achat d'Alloco Poulet / Cantine NCI",""],
  // Transfer + expenses Jan 8 (recorded later)
  ["C13","2026-01-08",10000,10000,"C1","Retrait SGCI - CAG",""],
  ["D21","2026-01-08",10000,10000,"C13","Carburant - NCI",""],
  // Expenses Jan 9
  ["D31","2026-01-09",2000,2000,"C13","Achat d'Alloco Poulet / Cantine NCI",""],
  ["D32","2026-01-09",1000,1000,"C13","Achat de sucrerie - Orangina",""],
  // Revenue: R7 → C13 Jan 9
  ["R7","2026-01-09",10000,0,"C13","Réception argent KKJAG",""],
  // Expense Jan 10
  ["D14","2026-01-10",7450,7450,"C13","Achat de sucrerie - AET B",""],
  // Transfer Jan 11
  ["C13","2026-01-11",10000,10000,"C5","Retrait OM vers portefeuille CAG",""],
  ["D38","2026-01-11",100,100,"C5","Frais de retrait OM",""],
  ["D22","2026-01-11",1500,1500,"C13","Lavage Auto ce jour",""],
  ["D21","2026-01-11",10000,10000,"C13","Carburant - NCI",""],
  // Expenses from C1 Jan 11
  ["D60","2026-01-11",1146,1146,"C1","Paiement Abonnement Espace de stockage - Microsoft OneDrive",""],
  ["D37","2026-01-11",24,24,"C1","Frais sur paiement Abonnement OneDrive",""],
  // Jan 12
  ["D31","2026-01-12",1700,1700,"C13","Achat de riz avec sauce arachide + viande de bœuf (SAPH)",""],
  ["R7","2026-01-12",300,0,"C13","Réception monnaie M. Bosso Louis - NCI",""],
  // Jan 13
  ["R7","2026-01-13",5000,0,"C13","Réception argent KKJAG",""],
  ["D19","2026-01-12",5000,5000,"C17","Souscription internet MTN",""],
  // Jan 14
  ["D31","2026-01-14",3000,3000,"C13","Achat de pomme de Terre et viande - SAPH / NCI",""],
  ["R14","2026-01-14",60600,0,"C5","Réception Rémunération sur Travaux de consultance - GIZ",""],
  // Jan 15
  ["C13","2026-01-15",45000,45000,"C5","Retrait OM vers portefeuille CAG",""],
  ["D38","2026-01-15",450,450,"C5","Frais de retrait OM",""],
  ["D24","2026-01-15",35000,35000,"C13","Paiement Assurance Hyundai Tucson",""],
  ["D21","2026-01-15",10000,10000,"C13","Carburant - NCI",""],
  ["D32","2026-01-14",500,500,"C13","Achat de sucrerie - Orangina",""],
  ["D44","2026-01-15",100,100,"C13","Remise argent à MMB - NCI",""],
  ["D31","2026-01-15",2000,2000,"C13","Achat de riz gras avec poulet - SAPH / NCI",""],
  // Jan 16
  ["D31","2026-01-16",1700,1700,"C5","Achat de riz avec sauce tomate + poulet - SAPH / NCI",""],
  ["D38","2026-01-16",17,17,"C5","Frais de dépôt OM",""],
  ["D47","2026-01-16",498,498,"C14","Régularisation compte WAVE EY",""],
  // Jan 17
  ["C13","2026-01-17",15000,15000,"C5","Retrait OM vers portefeuille CAG",""],
  ["D38","2026-01-17",150,150,"C5","Frais de retrait OM",""],
  ["D32","2026-01-17",1000,1000,"C13","Achat de sucrerie - Orangina",""],
  ["D44","2026-01-17",200,200,"C13","Remise argent à Tra Vanié - Transport",""],
  // Jan 18
  ["R7","2026-01-18",100,0,"C13","Réception argent KKJAG",""],
  ["D32","2026-01-18",1000,1000,"C13","Achat de sucrerie - Coca cola",""],
  ["D21","2026-01-18",10000,10000,"C13","Carburant - NCI",""],
  ["D22","2026-01-18",1500,1500,"C13","Lavage Auto ce jour",""],
  ["D33","2026-01-18",1000,1000,"C13","Coiffure",""],
  ["D32","2026-01-18",100,100,"C13","Achat de super mint",""],
  ["D32","2026-01-18",200,200,"C13","Achat de pain",""],
  ["D9","2026-01-18",2000,2000,"C20","Dépôt Wave à KKJAG par AET B",""],
  ["D38","2026-01-18",20,20,"C20","Frais de dépôt Wave",""],
  // Jan 19
  ["D36","2026-01-19",2500,2500,"C23","Régularisation Péage",""],
  // Jan 21
  ["R3","2026-01-21",33600,0,"C13","Réception notes de frais EY",""],
  // Transfer saccoche
  ["C13","2026-01-21",300,300,"C29","Transfert saccoche vers portefeuille",""],
  ["C29","2026-01-21",200,200,"C13","Transfert de pièces vers saccoche TbT",""],
  // Jan 22
  ["D9","2026-01-22",5000,5000,"C13","Remise argent à KKJAG pour son transport",""],
  ["D44","2026-01-22",3000,3000,"C13","Achat de souris pour MOM KKJAG",""],
  ["D21","2026-01-22",10000,10000,"C13","Carburant - NCI",""],
  ["R7","2026-01-22",50,0,"C7","Bonus MoMo",""],
  // Jan 23 - Salaire NCI
  ["R15","2026-01-23",1200000,0,"C1","Salaire - NCI",""],
  ["D54","2026-01-23",1887,1887,"C1","Paiement abonnement Spotify AB 2301",""],
  ["D37","2026-01-23",40,40,"C1","Frais sur abonnement spotify AB 2301",""],
  ["D48","2026-01-23",1428,1428,"C1","Paiement Abonnement Crunchy-Roll",""],
  ["D37","2026-01-23",30,30,"C1","Frais sur Abonnement CrunchyRoll",""],
  ["D20","2026-01-23",93,93,"C15","Régul Compte de communication professionnel - EY",""],
  ["D18","2026-01-23",3392,3392,"C16","Dépenses appel Orange CAG",""],
  ["D18","2026-01-23",632,632,"C18","Régul appel Moov CAG",""],
  // R8 standalone (Solde AET B)
  ["R8","2026-01-23",15571,0,"","Solde AET B",""],
  ["R7","2026-01-23",19,0,"C8","Intérêts Momo KASH",""],
  // Jan 24
  ["D51","2026-01-24",10000,10000,"C1","Cotisation Epargne Compte PLZ - SGCI","C32"],
  ["D11","2026-01-24",5700,5700,"C1","Paiement Abonnement Netflix",""],
  ["D37","2026-01-24",125,125,"C1","Frais sur Abonnement Netflix",""],
  ["R8","2026-01-24",5000,0,"C13","Réception argent Ancien Zouzou",""],
  ["D14","2026-01-24",4500,4500,"C13","Achat de sucrerie - AET B",""],
  ["D44","2026-01-24",500,500,"C13","Remise commission vigile - NSIA",""],
  ["D21","2026-01-24",5000,5000,"C20","Carburant - Autres (AET B)",""],
  // R8 standalone
  ["R8","2026-01-24",5000,0,"","Réception argent AET B - Carburant",""],
  // Jan 25
  ["D59","2026-01-25",600000,600000,"C1","Cotisation Epargne Maison","C2"],
  ["D55","2026-01-25",85000,85000,"C1","Cotisation Epargne CORIS BANK CAG","C27"],
  ["D37","2026-01-25",1000,1000,"C1","Frais de virement - Cotisation Epargne CORIS BANK CAG",""],
  ["C13","2026-01-25",80000,80000,"C1","Retrait SGCI - CAG",""],
  ["D8","2026-01-25",80000,80000,"C13","Argent du mois KKJAG",""],
  ["D21","2026-01-25",10000,10000,"C13","Carburant - NCI",""],
  ["D2","2026-01-25",1500,1500,"C13","Lavage Auto ce jour",""],
  // Jan 26
  ["R2","2026-01-26",90000,0,"C1","Salaire MINDEF",""],
  ["D57","2026-01-26",150000,150000,"C1","Cotisation Epargne Compte Créditmatic 3 - SGCI","C33"],
  // Jan 27
  ["D31","2026-01-27",500,500,"C13","Achat de galettes avec baca",""],
  ["C13","2026-01-27",50000,50000,"C1","Retrait SGCI - CAG",""],
  ["C13","2026-01-27",10000,10000,"C1","Retrait SGCI - CAG",""],
  ["D9","2026-01-27",5500,5500,"C13","Achat de médicaments KKJAG",""],
  ["D9","2026-01-27",50000,50000,"C13","Remise argent à KKJAG pour son commerce",""],
  ["D52","2026-01-27",7000,7000,"C1","Prélèvement Prime Yaconfort",""],
  ["D47","2026-01-27",200,200,"C13","Régularisation Espèces",""],
  // Jan 28
  ["D58","2026-01-28",1222,1222,"C1","Paiement Abonnement à Google One",""],
  ["D37","2026-01-28",26,26,"C1","Frais sur Abonnement à Google One",""],
  ["D32","2026-01-28",2000,2000,"C13","Course NCI",""],
  ["D44","2026-01-28",1000,1000,"C13","Paiement transport Christelle Ando",""],
  // R8 standalone
  ["R8","2026-01-28",8000,0,"","Réception argent par AET B",""],
  // Jan 29
  ["C13","2026-01-29",65000,65000,"C1","Retrait SGCI - CAG",""],
  ["D21","2026-01-29",10000,10000,"C13","Carburant - NCI",""],
  ["D9","2026-01-29",50000,50000,"C13","Remise argent à KKJAG pour son commerce",""],
  ["D31","2026-01-29",1700,1700,"C13","Achat de Garba - SAPH",""],
  ["D31","2026-01-29",1700,1700,"C13","Achat de nourriture de Louis",""],
  ["D32","2026-01-29",1000,1000,"C13","Achat de sucrerie - Présséat Cocktail",""],
  // Jan 30
  ["D29","2026-01-30",8000,8000,"C20","Achat de chaussures de basket - KD 14",""],
  ["R8","2026-01-30",1000,0,"C13","Réception argent de commerce KKJAG",""],
  ["D29","2026-01-30",1500,1500,"C13","Paiement frais de livraison chaussures de basket",""],
  // Jan 31
  ["C13","2026-01-31",150000,150000,"C1","Retrait SGCI - CAG",""],
  ["D9","2026-01-31",115000,115000,"C13","Paiement livraison colis pour commerce KKJAG",""],
  ["R8","2026-01-31",1000,0,"C13","Réception argent de commerce KKJAG",""],
  ["D36","2026-01-31",500,500,"C23","Péage",""],
  ["D36","2026-01-31",500,500,"C13","Péage",""],
  ["D38","2026-01-31",200,200,"C6","Paiement Frais de dépôt Wave pour envoie argent à KKJAG",""],
  ["D29","2026-01-31",5000,5000,"C13","Paiement pressing - retait veste + chemise repassées",""],

  // === FEBRUARY ===
  ["D22","2026-02-01",1500,1500,"C13","Lavage Auto ce jour",""],
  ["D21","2026-02-01",10000,10000,"C13","Carburant - NCI",""],
  ["R8","2026-02-01",2000,0,"C23","Réception argent KKJAG",""],
  ["D36","2026-02-01",1000,1000,"C23","Péage",""],
  ["D32","2026-02-01",600,600,"C13","Achat de yaourt + pain",""],
  ["R7","2026-02-01",65,0,"C27","Intérêts CORIS BANK",""],
  ["D37","2026-02-01",9,9,"C27","Prélèvement libératoire CORIS BANK",""],
  ["R7","2026-02-01",3,0,"C22","Intérêts Orange Bank",""],
  ["R9","2026-02-01",25000,0,"C17","Rechargement unité pro",""],
  ["D47","2026-02-01",20000,20000,"C17","Perte sur crédit pro",""],
  // Feb 2
  ["C5","2026-02-02",20000,20000,"C13","Dépôt OM CAG",""],
  ["D38","2026-02-02",100,100,"C5","Frais de dépôt OM",""],
  ["D16","2026-02-02",20000,20000,"C5","Paiement Internet Maison",""],
  ["D44","2026-02-02",200,200,"","Paiement photocopie Facture CIE",""],
  ["D44","2026-02-02",100,100,"C13","Paiement photocopie CNI",""],
  ["D31","2026-02-02",1700,1700,"C13","Achat de riz avec sauce tomate + poulet",""],
  ["D45","2026-02-02",2000,2000,"C13","Paiement de certificat de résidence",""],
  ["D47","2026-02-02",210,210,"C20","Régularisation charge",""],
  // Feb 3
  ["C13","2026-02-03",60000,60000,"C1","Retrait SGCI - CAG",""],
  ["D21","2026-02-03",53000,53000,"C13","Carburant Plein - NCI","Plein ce jour: Montant total = 53 013, Volume = 64.65L, Prix unitaire = 820"],
  ["D31","2026-02-03",2000,2000,"C13","Achat de riz avec sauce arachide + viande de bœuf",""],
  ["D44","2026-02-03",5000,5000,"C13","Remise argent à MOM CAG",""],
  // Feb 7
  ["D32","2026-02-07",200,200,"C13","Achat de youki pomme mini",""],
  // Feb 11
  ["C13","2026-02-11",55000,55000,"C27","Retrait CORIS BANK - CAG",""],
  ["C6","2026-02-11",255000,255000,"C13","Dépôt Wave CAG",""],
  ["R8","2026-02-11",205000,0,"C13","Réception argent de KKJAG pour payer son commerce - Dubai",""],
  ["C13","2026-02-11",40000,40000,"C27","Retrait CORIS BANK - CAG",""],
  ["D9","2026-02-11",250000,250000,"C6","Paiement à Tama Change pour Dubai",""],
  ["D38","2026-02-11",2500,2500,"C6","Frais de dépôt Wave",""],
  ["D9","2026-02-11",35000,35000,"C6","Paiement Cadeau de Saint Valentin pour KKJAG",""],
  ["D38","2026-02-11",350,350,"C6","Frais de dépôt Wave",""],
  ["C6","2026-02-11",35000,35000,"C13","Dépôt Wave CAG",""],
  ["D32","2026-02-11",1000,1000,"C13","Achat de sucrerie - Orangina",""],
  ["C23","2026-02-11",2000,2000,"C6","Rechargement Carte Péage HKB",""],
  // Feb 12
  ["D60","2026-02-12",1120,1120,"C1","Paiement Abonnement Microsoft OneDrive",""],
  ["D37","2026-02-12",24,24,"C1","Frais sur paiement Abonnement OneDrive",""],
  // Feb 13
  ["R13","2026-02-13",20000,0,"C13","Salaire NOVIANS",""],
  ["D32","2026-02-13",2000,2000,"C13","Achat de sucrerie (présséat + Coca Cola)",""],
  ["D9","2026-02-13",1000,1000,"C13","Remboursement KKJAG pour son activité",""],
  // Feb 14
  ["D9","2026-02-14",4000,4000,"C13","Remise argent pour MOM KKJAG",""],
  ["D9","2026-02-14",5000,5000,"C13","Paiement transport KKJAG",""],
  ["D44","2026-02-14",1000,1000,"C13","Remise argent à MOM CAG",""],
  ["D22","2026-02-14",2000,2000,"C13","Lavage Auto ce jour",""],
  // Feb 13
  ["D36","2026-02-13",1000,1000,"C23","Péage",""],
  // Feb 16
  ["D31","2026-02-16",5000,5000,"C13","Achat de nourriture au bureau (MMB & Danielle)",""],
  ["D32","2026-02-16",1000,1000,"C13","Achat de sucrerie - Présséat Pomme",""],
  // Feb 17
  ["D9","2026-02-17",300,300,"C13","Achat de 03 sachets de lait pour KKJAG",""],
  // Feb 18
  ["D32","2026-02-18",1000,1000,"C13","Achat de sucrerie - Orangina",""],
  ["R8","2026-02-18",1000,0,"C13","Réception argent KKJAG",""],
  ["D32","2026-02-18",1000,1000,"C13","Achat de salade de fruit",""],
  // Feb 19
  ["D32","2026-02-19",1000,1000,"C13","Achat de salade de fruit",""],
  ["D11","2026-02-19",5673,5673,"C1","Paiement Abonnement Netflix",""],
  ["D37","2026-02-19",124,124,"C1","Frais sur Abonnement Netflix",""],
  // Feb 20
  ["D31","2026-02-20",4000,4000,"C13","Nourriture de midi (Louis et Moi) à SAPH",""],
  ["D32","2026-02-20",1000,1000,"C13","Achat de salade de fruit",""],
  ["D44","2026-02-20",200,200,"C13","Remise argent à Marcel Abo",""],
  // Feb 22
  ["D22","2026-02-22",1500,1500,"C13","Lavage Auto ce jour",""],
  ["D21","2026-02-22",15000,15000,"C13","Carburant - NCI",""],
  ["C1","2026-02-22",20000,20000,"C2","Virement de mon compte epargne à mon compte courant",""],
  ["C13","2026-02-22",20000,20000,"C1","Retrait de mon compte Courant SGCI",""],
  ["R8","2026-02-22",2000,0,"C6","Réception argent KKJAG",""],
  // Feb 23
  ["R17","2026-02-23",12000,0,"C13","Réception Note de frais pour Co-Production/SOLPROD - NCI","Situé à Cocody Danga"],
  ["D31","2026-02-23",1000,1000,"C13","Remise argent à Mr Louis",""],
  ["D32","2026-02-23",1000,1000,"C13","Achat de sucrerie - Coca cola",""],
  ["D32","2026-02-23",1000,1000,"C13","Achat divers Mom CAG",""],
  ["D54","2026-02-23",1875,1875,"C1","Paiement abonnement Spotify",""],
  ["D37","2026-02-23",40,40,"C1","Frais sur abonnement spotify",""],
  ["D48","2026-02-23",1419,1419,"C1","Paiement Abonnement Crunchy-Roll",""],
  ["D37","2026-02-23",30,30,"C1","Frais sur Abonnement CrunchyRoll",""],
  ["D9","2026-02-23",2000,2000,"C6","Dépôt Wave à KKJAG",""],
  ["D38","2026-02-23",20,20,"C6","Frais de dépôt Wave",""],
  // Feb 24
  ["D44","2026-02-24",1000,1000,"C13","Remise argent à MOM CAG",""],
  // Feb 25 - Salaire NCI
  ["R15","2026-02-25",1200000,0,"C1","Salaire - NCI",""],
  ["D51","2026-02-26",10000,10000,"C1","Cotisation Epargne Compte PLZ - SGCI","C32"],
  ["D57","2026-02-25",150000,150000,"C1","Cotisation Epargne Compte Créditmatic 3 - SGCI","C33"],
  ["D59","2026-02-25",620000,620000,"C1","Cotisation Epargne Maison","C2"],
  ["C4","2026-02-25",200,200,"C6","Virement Wave vers BICICI",""],
  ["D38","2026-02-25",5,5,"C6","Frais de Virement Wave vers BICICI",""],
  ["R10","2026-02-25",295,0,"C9","Régularisation argent Wave MTN",""],
  // Feb 26
  ["D9","2026-02-26",1500,1500,"C13","Remise argent à KKJAG",""],
  ["D32","2026-02-26",3000,3000,"C13","Achat de grand menu - SAPH",""],
  ["R2","2026-02-26",90000,0,"C1","Salaire MINDEF",""],
  // Feb 27
  ["D58","2026-02-27",1222,1222,"C1","Paiement Abonnement à Google One",""],
  ["D37","2026-02-27",26,26,"C1","Frais sur Abonnement à Google One",""],
  ["D29","2026-02-27",2000,2000,"C13","Achat réparation de chaussure",""],
  ["D21","2026-02-27",5000,5000,"C13","Carburant - NCI",""],
  ["C13","2026-02-27",50000,50000,"C1","Retrait SGCI - CAG",""],
  // Feb 28
  ["R8","2026-02-28",10000,0,"C13","Réception argent Christelle",""],
  ["D21","2026-02-28",10000,10000,"C13","Carburant",""],
  ["D36","2026-02-28",1000,1000,"C23","Frais de Péage pour aller chercher son ami à l'aéroport",""],
  ["D32","2026-02-28",500,500,"C13","Remise argent à Christelle pour achat de jus de passion",""],
  ["D29","2026-02-28",50000,50000,"C13","Paiement de parfum chez Mel Cosmetic",""],
  ["D47","2026-02-28",25000,25000,"C17","Régul unité Pro",""],

  // === MARCH ===
  ["C13","2026-03-01",130000,130000,"C1","Retrait SGCI - CAG",""],
  ["D22","2026-03-01",1500,1500,"C13","Lavage Auto ce jour",""],
  ["R9","2026-03-01",25000,0,"C17","Rechargement unité pro",""],
  ["R7","2026-03-01",102,0,"C27","Intérêts CORIS BANK",""],
  ["D37","2026-03-01",14,14,"C27","Prélèvement sur intérêts CORIS BANK",""],
  ["R7","2026-03-01",3,0,"C22","Intérêts Orange Bank",""],
  // Mar 2
  ["D8","2026-03-02",60000,60000,"C13","Remise argent du mois à KKJAG (partiel)",""],
  ["C5","2026-03-02",20000,20000,"C13","Dépôt OM CAG",""],
  ["D16","2026-03-02",20000,20000,"C5","Paiement Internet Wifi Maison",""],
  ["D38","2026-03-02",100,100,"C5","Frais de dépôt OM",""],
  ["D32","2026-03-02",1000,1000,"C13","Achat de sucrerie coca cola",""],
  // Mar 3
  ["D31","2026-03-03",1700,1700,"C13","Achat de petit menu SAPH",""],
  // Mar 4
  ["D31","2026-03-04",1700,1700,"C13","Achat de petit menu SAPH",""],
  ["D21","2026-03-04",10000,10000,"C13","Carburant - NCI",""],
  // Mar 5
  ["D31","2026-03-05",1700,1700,"C13","Achat de petit menu SAPH",""],
  ["D32","2026-03-05",1500,1500,"C13","Achat de dêguê",""],
  // Mar 6
  ["R13","2026-03-06",30000,0,"C13","Réception salaire NOVIANS",""],
  ["D44","2026-03-06",10000,10000,"C13","Remise argent à MOM CAG",""],
  ["D32","2026-03-06",1000,1000,"C13","Achat de sucrerie - Orangina",""],
  ["D29","2026-03-06",1000,1000,"C13","Remise argent pour lessive Maison",""],
  // Mar 7
  ["D21","2026-03-07",10000,10000,"C13","Carburant - NCI",""],
  ["D32","2026-03-07",100,100,"C13","Achat d'hollywood",""],
  ["D30","2026-03-07",37500,37500,"C13","Courses à Casino Angré 22e",""],
  ["D30","2026-03-07",500,500,"C13","Achat de lotus (Style) pour la voiture ce jour",""],
  // Mar 8
  ["C13","2026-03-08",55000,55000,"C1","Retrait SGCI - CAG",""],
  ["D27","2026-03-08",10000,10000,"C13","Rechargement Gaz de climatiseur (Tucson)",""],
  ["D22","2026-03-08",1500,1500,"C13","Lavage Auto ce jour",""],
  ["D27","2026-03-08",200,200,"C13","Prestation - pression des Pneus Tucson Hyundai",""],
  ["D30","2026-03-08",1300,1300,"C13","Achat de paquet de cube maggie",""],
  ["D32","2026-03-08",700,700,"C13","Achat de yaourt + pain",""],
  ["D44","2026-03-08",10000,10000,"C13","Remise argent du mois à MOM & DAD CAG",""],
  // Mar 9
  ["D9","2026-03-09",1000,1000,"C13","Remise argent à KKJAG pour transport",""],
  ["D31","2026-03-09",1500,1500,"C13","Achat de petit menu SAPH",""],
  // Mar 10
  ["D31","2026-03-10",2000,2000,"C13","Achat de petit menu SAPH",""],
  ["D21","2026-03-10",15000,15000,"C13","Carburant - NCI",""],
  // Mar 11
  ["D31","2026-03-11",1500,1500,"C13","Achat de petit menu SAPH",""],
  ["D60","2026-03-11",1148,1148,"C1","Paiement Abonnement Microsoft OneDrive",""],
  ["D37","2026-03-12",24,24,"C1","Frais sur paiement Abonnement OneDrive",""],
  ["D9","2026-03-11",1000,1000,"C13","Remise argent à KKJAG",""],
  ["D44","2026-03-11",100,100,"C13","Remise argent Mme Danielle NCI",""],
  // Mar 12
  ["C13","2026-03-12",65000,65000,"C1","Retrait de ma carte SGCI - CAG",""],
  ["D25","2026-03-12",36000,36000,"C13","Vidange Tucson ce jour",""],
  ["D31","2026-03-12",2000,2000,"C13","Achat de pain sucrée - NCI",""],
  // Mar 13
  ["D44","2026-03-13",2000,2000,"C13","Remise transport à MOM KKJAG",""],
  ["C9","2026-03-13",20000,20000,"C13","Dépôt Wave CAG",""],
  ["D23","2026-03-13",20000,20000,"C9","Paiement partiel plaquettes de frein Tucson à Alexis",""],
  ["D38","2026-03-13",200,200,"C9","Frais d'envoi à Alexis",""],
  ["D21","2026-03-13",10000,10000,"C13","Carburant - NCI",""],
  // Mar 14
  ["C13","2026-03-14",20000,20000,"C1","Retrait de ma carte SGCI - CAG",""],
  ["D23","2026-03-14",15000,15000,"C13","Paiement reliquat plaquettes de frein Tucson à Alexis",""],
  ["D32","2026-03-14",1000,1000,"C13","Achat de sucrerie - Coca cola",""],
  ["D32","2026-03-14",1000,1000,"C13","Achat de sucrerie - Présséat raisin-pomme",""],
  ["D29","2026-03-14",400,400,"C13","Paiement pressing - retait veste + chemise repassées",""],
  ["D9","2026-03-14",2000,2000,"C13","Paiement livraison de nourriture (KFC) pour KKJAG",""],
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const txToInsert: any[] = [];
  // Track savings pairs: when notes field = "C##", it means the D# expense has a paired income to that account
  const savingsPairs: { date: string; amount: number; accountRef: string; description: string }[] = [];

  for (const row of ROWS) {
    const [ref, date, aug, dim, contrepartie, description, notes] = row;

    if (ref.startsWith('R')) {
      // Revenue/Income
      const categoryId = CAT[ref] || null;
      const accountId = contrepartie ? A[contrepartie] || null : null;
      txToInsert.push({
        user_id: UID, type: 'income', amount: aug,
        account_id: accountId, category_id: categoryId,
        date, description, notes: notes || null,
      });
    } else if (ref.startsWith('D')) {
      // Expense
      const categoryId = CAT[ref] || null;
      const accountId = contrepartie ? A[contrepartie] || null : null;
      txToInsert.push({
        user_id: UID, type: 'expense', amount: dim,
        account_id: accountId, category_id: categoryId,
        date, description, notes: notes && notes.startsWith('C') ? null : (notes || null),
      });
      // If notes contains a C## reference, it's a savings pair - create income to that account
      if (notes && /^C\d+$/.test(notes)) {
        const destAccountId = A[notes] || null;
        if (destAccountId) {
          txToInsert.push({
            user_id: UID, type: 'income', amount: dim,
            account_id: destAccountId, category_id: null,
            date, description, notes: 'Cotisation épargne',
          });
        }
      }
    } else if (ref.startsWith('C') && aug > 0 && dim > 0 && contrepartie) {
      // Transfer between accounts
      const fromId = A[contrepartie] || null;
      const toId = A[ref] || null;
      // Expense from source
      txToInsert.push({
        user_id: UID, type: 'expense', amount: dim,
        account_id: fromId, category_id: null,
        date, description, notes: '↗ Transfert',
      });
      // Income to destination
      txToInsert.push({
        user_id: UID, type: 'income', amount: aug,
        account_id: toId, category_id: null,
        date, description, notes: '↙ Transfert',
      });
    }
    // Skip standalone C# lines (already handled by R# pairing or savings)
  }

  // Batch insert all transactions
  const batchSize = 50;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < txToInsert.length; i += batchSize) {
    const batch = txToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('transactions').insert(batch);
    if (error) {
      errors.push(`Batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  // real_balance is no longer auto-updated; user manages it manually

  return new Response(JSON.stringify({
    total_rows: ROWS.length,
    transactions_created: inserted,
    errors,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
