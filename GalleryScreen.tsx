import { useState, useEffect } from "react";
import { StyleSheet ,Text, View, Button, Alert, TextInput, FlatList, Pressable, Modal}  from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, StackActions } from "@react-navigation/native";
import type {StaticScreenProps} from '@react-navigation/native';


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

{/* Recibe y muestra carpeta actual */}
type Props = StaticScreenProps<{
    folderURI: string;
}>;

export default function GalleryScreen({ route }: Props) {
    const {folderURI} = route.params;
    {/* Navigation es el objeto que cambia pantalla */}
    const navigation = useNavigation();

    {/* Carpetas que hat dentro de esta, y texto de nombre nuevo*/}
    const [carpetas, setCarpetas] = useState<string[]>([]);
    const [newName, setNewName] = useState('');

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


{/*Se carga la lista al abrir la carpeta */}
useEffect(() =>{
    load();
}, [folderURI]);

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

{/* Abre una subcarpeta. Se apilan y el boton atras sube un nivel */}
function open(uri: string) {
    navigation.dispatch(StackActions.push('Gallery', {folderURI: uri}));
}
return (
    <View style={styles.container}>
        {/* Dice carpeta actual */}
        <Text style={styles.route}>{visibleRoute(folderURI)}</Text>
        <TextInput
        style={styles.input}
        placeholder='Nombre de la carpeta nueva'
        value={newName}
        onChangeText={setNewName}
        onSubmitEditing={create}/>
        <Button title='Crear carpeta' onPress={create}/>
        

        {/* Lista de carpetas. Se abre la que se toque/cliquee. keyExtractor da a cada una un identificador (URI) */}
        <FlatList
        style={styles.lista}
        data={carpetas}
        keyExtractor={(uri => uri)}
        renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={styles.item}>
                <Text style={styles.itemText}>{folderName(item)}</Text>
            </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.vacio}>Todavia no hay carpetas</Text>}
        />
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
});
