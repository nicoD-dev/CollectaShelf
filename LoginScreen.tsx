import { useState } from "react";
import { StyleSheet, Text, View, Button, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
{/* Aplica funciones hash para cifrar datos */}
import * as Crypto from "expo-crypto";

{/*Clave para guardar la carpeta principal de la aplicacion */}
const KEY_ROOT_URI = 'collectashelf:rootFolderURI';

{/* Clave donde se guardan los usuarios: { "nombre": "hash de la contraseña" } */}
const KEY_USERS = 'collectashelf:users';

{/* nombre de carpeta legible a travez de su URI */}
function folderName(uri: string): string {
  return decodeURIComponent(uri).split('/').pop() ?? uri;
}

export default function LoginScreen() {
    const navigation = useNavigation();
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    const entrar = async () => {
        setSending(true);
        setError(null);

        try {
            const name = user.trim();
            if (!name || !password) {
                setError('Escribir nombre y contraseña')
                return;
            }
            {/* Evita nombre con caracteres de carpeta */}
            if (/[\\/]/.test(name) || name.startsWith('.')) {
                setError('Usuario invalido');
                return;
            }
            

            {/* La contraseña se guarda convertida en hash */}
            const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
            const saved = await AsyncStorage.getItem(KEY_USERS);
            const users: Record<string, string> = saved ? JSON.parse(saved) : {};


            if (users[name] === undefined)
            {
                {/* usuario nuevo se guarda */}
                users[name] = hash;
                await AsyncStorage.setItem(KEY_USERS, JSON.stringify(users));
            } else if (users[name] !== hash) {
                setError('Usuario o contraseña incorrectos');
                return;
            }

            {/* Se abre collectashelf, se crea un usuario si no existe uno */}
            const rootURI = await AsyncStorage.getItem(KEY_ROOT_URI);
            if (!rootURI)
            {
                setError('No se encontro la carpeta principal');
                return;
            }
            const contents = await FileSystem.StorageAccessFramework.readDirectoryAsync(rootURI);
            {/* Chequea si existe una carpeta para ese usuario. Si no hay es "undefined". Si hay, da la URI de la misma */}
            const existing = contents.find((uri) => folderName(uri) === name);
            const userFolder = existing ?? await FileSystem.StorageAccessFramework.makeDirectoryAsync(rootURI, name);

            setPassword('')
            navigation.navigate('Gallery', {folderURI: userFolder});


        } catch (e) 
        {
            console.error('Error al ingresar', e)
            setError('No se pudo ingresar');

        } finally {setSending(false)}
    };
    return (
        <View style={styles.container}>
            <Text>CollectaShelf</Text>
            <TextInput style={styles.input} placeholder="Ingresar usuario" value={user} onChangeText={setUser} autoCapitalize="none"/>
            <TextInput style={styles.input} placeholder='Ingresar contraseña' value={password} onChangeText={setPassword} secureTextEntry/>
            <Button title={sending ? 'Ingresando' : 'Ingresar'} onPress={entrar} disabled={sending}></Button>
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center'
  },
  input: {
    width: '80%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
  },
  error: {
    color: 'red',
    marginTop: 15,
    textAlign: 'center',
  },
});
