import { useState, useCallback, useRef } from "react";
import { StyleSheet ,Text, View, Button, Alert, TextInput, FlatList, Pressable, Modal, Image, useWindowDimensions}  from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, StackActions, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {StaticScreenProps} from '@react-navigation/native';
import { Directory, File } from "expo-file-system";


{/*Obtiene un nombre de carpeta legible a partir de su URI */}
function folderName(uri: string): string {
    return decodeURIComponent(uri).split('/').pop() ?? uri;
}

{/*Texto que ve el usuario, mostrando la ruta de archivos */}
function visibleRoute(uri: string): string {
    const parts = decodeURIComponent(uri).split('/');
    const start = parts.lastIndexOf('CollectaShelf')
    {/* Si no se encuentra collectashelf, devuelve -1, y solo muestra nombre de carpeta actual*/}
    if (start === -1) return folderName(uri);
    return parts.slice(start).join(' > ')
}

{/* Define si una URI es carpeta o no, dependiendo de si se puede leer por dentro o no */}
async function isFolder(uri:string): Promise<Boolean> {
    try {
        await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
        return true;
    } catch (error) {
        return false;
    }
}

{/* Define el tipo de archivo segun su extension. Necesario para el copiado */}
function fileCheck(name: string): string {
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    const types: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', pdf: 'application/pdf', txt: 'text/plain',
    };
    return types[ext] ?? 'application/octet-stream';
}

{/* Elementos a moverse, esperando a confirmar carpeta de origen */}
let toMove: string[] = [];


{/* Recibe y muestra carpeta actual */}
type Props = StaticScreenProps<{
    folderURI: string;
}>;

export default function GalleryScreen({ route }: Props) {
    const {folderURI} = route.params;
    {/* Navigation es el objeto que cambia pantalla */}
    const navigation = useNavigation();

    {/* Hace que el visor de imagenes ocupe toda la pantalla (tamaño completo) */}
    const {width} = useWindowDimensions();

    {/* Carpetas que hat dentro de esta, y texto de nombre nuevo*/}
    const [carpetas, setCarpetas] = useState<string[]>([]);
    const [newName, setNewName] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    

    {/* Lee el contenido de la carpeta y actualiza la pantalla */}
    async function load() {
        try {
            const content = await FileSystem.StorageAccessFramework.readDirectoryAsync(folderURI);
            setCarpetas(content.sort((a, b) =>
            folderName(a).toLowerCase().localeCompare(folderName(b).toLowerCase())
        ));
        } catch (error) {
            console.error('Error al listar carpetas', error);
            Alert.alert('Error', 'No se pudo leer la carpeta');
        }
    }


{/* Se carga la lista cada vez que esta pantalla se vuelve visible */}
useFocusEffect(useCallback(() => {
    load();
}, [folderURI]));


const [creating, setCreating] = useState(false);
{/* Crea la carpeta nombrada por el usuario */}
async function create() {
    const name = newName.trim();

    {/* Si hay un error se avisa y no se crea la carpeta */}
    if (!name) {
        Alert.alert('Nombre vacio', 'Escribi un nombre para la carpeta');
        return;
    }
    {/* Impide nombres con barras para evitar subcarpetas */}
    if (/[\\/]/.test(name)) {
        Alert.alert('Nombre invalido', 'El nombre no puede contener barras');
        return;
    }
    {/* Se compara sin distinguir mayusculas */}
    if (carpetas.some((uri) => folderName(uri).toLowerCase() === name.toLowerCase())) {
        Alert.alert('Carpeta existente', `Ya existe una carpeta llamada "${name}"`);
        return;
    }
    try {
        {/* Se crea carpeta dentro de la actual y se recarga la lista */}
        await FileSystem.StorageAccessFramework.makeDirectoryAsync(folderURI, name);
        setNewName('');
        await load();
    } catch (error) {
        console.error('Error al crear carpeta', error)
        Alert.alert('Error', 'No se pudo crear la carpeta');
    } 

} 
{/* Abre una carpeta. Se apilan y el boton atras sube un nivel */}
async function open(uri: string) {
    if (!(await isFolder(uri))) return;
    navigation.dispatch(StackActions.push('Gallery', {folderURI: uri}));
}

{/* Selecciona o deselecciona un elemento */}
function toggle(uri: string) {
    {/* usa ternary y spread operators para copiar todo lo de la lista seleccionada */}
    setSelected(selected.includes(uri) ? selected.filter((u) => u !== uri) : [...selected, uri]);
}

{/* Confirmacion para eliminar un elemento */}
function confirmDelete() {
    Alert.alert('Eliminar', `Se van a eliminar ${selected.length} elemento(s). Esta accion no se puede deshacer.`, [
        {text: 'Cancelar', style: 'cancel'},
        {text: 'Eliminar', style: 'destructive', onPress: async () => {
            for (const uri of selected){
                await FileSystem.deleteAsync(uri, { idempotent: true});
            }
            setSelected([]);
            await load();
        }},
    ]);
}

{/* Se marca la seleccion para mover*/}
function markToMove() {
    toMove = selected;
    setSelected([]);
}

{/* Cancela el mover */}
function cancelMove() {
    toMove = [];
    setSelected([]);
}

{/* Copia un archivo o una carpeta completa, incluyendo sus subcarpetas */}
async function copyItem(uri: string, destination: string, newName?: string) {
    {/* Chequea si el elemento es una carpeta */}
    if (await isFolder(uri)) {
        {/* Mantiene el nombre original en caso de error, usando coalescing operator */}
        const folderTargetName = newName ?? folderName(uri);
        
        const newFolder =
            await FileSystem.StorageAccessFramework.makeDirectoryAsync(
                destination,
                folderTargetName
            );

        {/* Obtiene todos los elementos que contiene la carpeta */}
        const contents =
            await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);

        for (const item of contents) {
            {/* Se pasa 'item' como origen y 'newFolder' como destino */}
            await copyItem(item, newFolder);
        }
    } else {
        {/* Obtiene el nombre completo y el tipo de archivo */}
        const fullName = newName ?? folderName(uri);
        const mime = fileCheck(fullName);

        const nameWithoutExtension = fullName.substring(0, fullName.lastIndexOf('.')) || fullName;

        const newFile =
            await FileSystem.StorageAccessFramework.createFileAsync(
                destination,
                nameWithoutExtension,
                mime
            );

        const content = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64
        });

        await FileSystem.writeAsStringAsync(newFile, content, {
            encoding: FileSystem.EncodingType.Base64
        });
    }
}

const [moving, setMoving] = useState(false);

{/* Se mueve a otra carpeta lo seleccionado */}
async function paste() {
    {/* Evita iniciar otro movimiento mientras uno está en curso */}
    if (moving) return;
    setMoving(true);

    

    try {
        {/* Recorre todos los elementos seleccionados para moverlos */}
        for (const uri of toMove) {
            if (folderURI.startsWith(uri)) {
                throw new Error('No se puede mover una carpeta dentro de sí misma');
            }

            await copyItem(uri, folderURI);
        }

        {/* Elimina los elementos originales una vez finalizada la copia */}
        for (const uri of toMove) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
        }

        {/* Limpia la selección y la lista de elementos */}
        toMove = [];
        setSelected([]);
        await load();

        Alert.alert('Listo', 'Elementos movidos correctamente');
    } catch (error) {
        console.error('Error al mover:', error);
        Alert.alert('Error', 'No se pudo completar el movimiento. Los originales se conservaron.');
    } finally {
        setMoving(false);
    }
}

const [renameVisible, setRenameVisible] = useState(false);
const [renameName, setRenameName] = useState('');
{/*Renombra el único elemento seleccionado*/}
async function renameItem() {
    const uri = selected[0];
    const name = renameName.trim();
    if (!name) return;

    {/* Si no cambio el nombre, solo se cierra el popup */}
    if (name === folderName(uri)) {
        setRenameVisible(false);
        return;
    }
    {/* Impide barras y nombres que ya existen en esta carpeta */}
    if (/[\\/]/.test(name)) {
        Alert.alert('Nombre invalido', 'El nombre no puede contener barras');
        return;
    }
    if (carpetas.some((u) => folderName(u).toLowerCase() === name.toLowerCase())) {
        Alert.alert('Nombre existente', `Ya existe "${name}"`);
        return;
    }

    try {
        {/* Se copia con el nombre nuevo y despues se borra el original */}
        await copyItem(uri, folderURI, name);
        await FileSystem.deleteAsync(uri, { idempotent: true });

        setRenameVisible(false);
        setRenameName('');
        setSelected([]);
        await load();
    } catch (error) {
        console.error('Error al renombrar', error);
        Alert.alert('Error', 'No se pudo renombrar. El original se conservo.');
    }
}

const [galleryVisible, setGalleryVisible] = useState(false);
const [imageIndex, setImageIndex] = useState(0);
{/*Identifica archivos de imagen*/}
function isImage(uri: string) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(folderName(uri));
}

{/* Fotos de la carpeta */}
const images = carpetas.filter(isImage);

{/*Abre la galería de imágenes*/}
function openImage(uri: string) {
    setImageIndex(images.indexOf(uri));
    setGalleryVisible(true);
}

{/* Toque corto abre o selecciona si se esta en modo seleccion. Si no abre carpeta */}
function tap(uri: string) 
{
    console.log('tap', folderName(uri), 'isImage:', isImage(uri), 'seleccionados:', selected.length);
    if (selected.length > 0) toggle(uri);
    else if (isImage(uri)) openImage(uri);
    else open(uri);
}


return (
    <View style={styles.container}>
        {/* Dice carpeta actual */}
        <Text style={styles.route}>{visibleRoute(folderURI)}</Text>
        {selected.length > 0 ?(
            <View style= {styles.bar}>
                <Text>{selected.length} seleccionado(s)</Text>
                {/* Si se esta moviendo, se desactiva para evitar multiples copias */}
                <Button title= {moving ? 'Moviendo...' : 'Mover'} onPress={markToMove} disabled={moving}/>
                {selected.length === 1 && (
                <Button
                title="Renombrar" onPress={() => {
                setRenameName(folderName(selected[0]));
                setRenameVisible(true);
                }}/>
                )}
                <Button title='Eliminar' onPress={confirmDelete}/>
                <Button title='Cancelar' onPress={() => setSelected([])}/>
                    </View>
        ) : (
            <>
            {toMove.length > 0 && (
                <View style={styles.bar}>
                    <Button title={`Pegar aqui (${toMove.length})`} onPress={paste}/>
                    <Button title='Cancelar' onPress={cancelMove}/>
                    </View>
        )}
         <TextInput
        style={styles.buttons}
        placeholder='Nombre de la carpeta nueva'
        value={newName}
        onChangeText={setNewName}
        onSubmitEditing={create}/>
        <Button title='Crear carpeta' onPress={create}/>
        <View style={{ height: 15 }} />
        <Button title='Tomar foto' onPress={() => navigation.navigate('Camera', { folderURI })}/>
    </>
)}
        

        {/* Lista de carpetas. Se abre la que se toque/cliquee. keyExtractor da a cada una un identificador (URI) */}
        <FlatList
        style={styles.lista}
        data={carpetas}
        keyExtractor={(uri => uri)}
        renderItem={({ item }) => (
             <Pressable 
             onPress={() => tap(item)}
             onLongPress={() => toggle(item)}
             style={[styles.item, selected.includes(item) && styles.itemSelected]}>
                <Text style={styles.itemText}>{folderName(item)}</Text>
            </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.vacio}>Todavia no hay carpetas</Text>}
        />

        {/* Muestra el popup para renombrar fotos y carpetas */}
        <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
        >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000080'}}>
        <View style={{ width: '85%', backgroundColor: 'white', padding: 20, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Renombrar</Text>

            <TextInput
                value={renameName}
                onChangeText={setRenameName}
                autoFocus
                selectTextOnFocus
                style={{
                    borderBottomWidth: 1,
                    borderColor: '#999',
                    marginVertical: 15,
                    padding: 8
                }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 15 }}>
                <Button
                    title="Cancelar"
                    onPress={() => setRenameVisible(false)}
                />
                <Button
                    title="Aceptar"
                    onPress={renameItem}
                />
            </View>
        </View>
    </View>
</Modal>
{/* Visor de fotos a pantalla completa */}
<Modal
    visible={galleryVisible} // Se ve cuando galleryvisible == true
    animationType="fade"
    onRequestClose={() => setGalleryVisible(false)}  // Boton atras de android, cierra el visor de imagenes
    >
    <View style={styles.viewer}>
        <FlatList
        data={images} // Imagenes de la carpeta
        horizontal // Deslizar de costado en lugar de arriba a abajo
        pagingEnabled // Hace "snap" de foto a foto en lugar de scrollear a medias
        initialScrollIndex={imageIndex} // Comienza en la foto que se toco
        getItemLayout={(_photoList, index) => ({ length: width, offset: width * index, index })} // Calcula la posicion de la imagen sin pasar por las anteriores
        keyExtractor={(uri) => uri} // Identificador de cada foto
        onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))} // Identifica donde se detiene el scroll y actualiza el contador
        renderItem={({item}) => (
            <Image source={{uri: item}} style={{width, height: '100%'}} resizeMode="contain"/> 
            // Contain hace que la foto ocupe el espacio de la pantalla, no mas. Evita que se corte una parte
        )}
        onScrollToIndexFailed={() => {}}
        />
        {/* Contador de foto actual +1 porque imageIndex inicia en 0 */}
        <Text style={styles.viewerCounter}>{imageIndex + 1}/{images.length}</Text>
        <View>
            <Button title="Cerrar" onPress={() => setGalleryVisible(false)}/>
        </View>
    </View>
</Modal>
    </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  route: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  lista: {
    marginTop: 20,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemText: {
    fontSize: 16,
  },
  vacio: {
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  itemSelected: {
    backgroundColor: '#d6e9ff',
  },
    bar: {
    gap: 10,
    marginBottom: 1,
  },
    buttons: {
    gap: 20,
    marginBottom: 10,
  },
  viewer: { flex: 1, backgroundColor: 'black' },
  viewerCounter: { position: 'absolute', top: 40, alignSelf: 'center', color: 'white', fontSize: 16 },
  viewerClose: { position: 'absolute', bottom: 40, alignSelf: 'center' },
});