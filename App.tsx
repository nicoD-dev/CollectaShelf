import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library'
import { useCameraPermissions, CameraView } from 'expo-camera' 
import { useEffect, useState } from 'react';
import {useNavigation, createStaticNavigation, StaticParamList} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';


{/*Clave para guardar la carpeta principal de la aplicacion */}
const KEY_ROOT_URI = 'collectashelf:rootFolderURI';

//Obtiene un nombre de carpeta legible a travez de su URI
function folderName(uri: string): string {
  return decodeURIComponent(uri).split('/').pop() ?? uri;
}
{/*onSuccess recibe la URI de la carpeta principal*/}
async function accesoAlmacenamiento(onSuccess: (rootFolderURI: string) => void) {
  try {
    {/*Variable que guarda si el usuario dio acceso al sistema de archivos, y donde*/}
    const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

    {/*Accedido con exito */}
    if (result.granted) {
      const storageChosenURI = result.directoryUri;
      console.log('Almacenamiento elegido: ', storageChosenURI);

      {/*Nombre de la carpeta base de la aplicacion */}
      const rootFolderName = "CollectaShelf";

      //se verifica si ya existe la carpeta, para evitar crear copias
      const existentes = await FileSystem.StorageAccessFramework.readDirectoryAsync(storageChosenURI);
      const carpetaExistente = existentes.find((uri) => folderName(uri) === rootFolderName);

      {/*Se crea la carpeta*/}
      const appFolderRoot = carpetaExistente ?? await FileSystem.StorageAccessFramework.makeDirectoryAsync(storageChosenURI, rootFolderName);
      console.log('Carpeta principal creada en ', appFolderRoot);

      {/* Se guarda la URI para que no se tenga que setear la app cada vez que se abre */}
      await AsyncStorage.setItem(KEY_ROOT_URI, appFolderRoot);
      

      {/*Se informa al usuario de la accion realizada*/}
      Alert.alert("Configuracion completada.", `Se establecio el almacenamiento y se creo la carpeta "${rootFolderName}"`);
      //se confirma que se completo la operacion y se pasa a la pantalla de login
      onSuccess(appFolderRoot);

      {/*En la proxima linea se le explica al usuario que hacer si cancela la operacion */}
    } else Alert.alert("Configuracion fallida", `Se debe seleccionar un directorio para guardar las imagenes de la app`)

  } catch (error) {
    {/*Ante un error de acceso al sistema se da este mensaje */}
  console.error("Error el crear carpeta de aplicacion", error);
  Alert.alert("Error", `No se pudo acceder al almacenamiento elegido`)

}
}

// Pantalla inicial que setea la app
function SetupScreen() {
  // navigation es el objeto que cambia pantalla
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text>Welcome to CollectaShelf</Text>
      {/* navigate('Folders') abre la pantalla folders*/}
      <Button title='Crear galeria' onPress={() => accesoAlmacenamiento(() => navigation.navigate('Login'))}></Button>
    </View>
  )
}

//Pantalla de login que se ve al iniciar la app
function LoginScreen() {
  const navigation =useNavigation();

  // Chequea si hay una carpeta de aplicacion guardada. Si la hay, va a la pantalla de login
  async function entrar() {
    const rootURI = await AsyncStorage.getItem(KEY_ROOT_URI);
    if (!rootURI) {
      Alert.alert('Error', 'No se encontro la carpeta principal');
      return;
    }
    navigation.navigate('Folders');
  }

  return (
    <View style={styles.container}>
      <Text>Login</Text>
      <Button title='Entrar' onPress={() => navigation.navigate('Folders')}></Button>
    </View>
  );  
}

// Pantalla con "galerias" creadas por el usuario
function FolderScreen() {
  return (
    <View style={styles.container}>
      <Text>Abre tus colecciones</Text>
    </View>
  );
}

{/*Lista de pantallas de la app y sus titulos*/}
const screens = {
  Setup: {
    screen: SetupScreen,
    options: {title: 'Welcome to CollectaShelf!', headerBackVisible: false},
  },
  Folders: {
    screen: FolderScreen,
    options: {title: 'Mis colecciones'},
  },
  Login: {
    screen: LoginScreen,
    options: {title: 'Login',  headerBackVisible: false}
  },
};

// Se definen las posibles pantallas de inicio de la aplicacion con un navigator
const SetupStack = createNativeStackNavigator({ initialRouteName: 'Setup', screens});
const LoginStack = createNativeStackNavigator({initialRouteName: 'Login', screens});

const SetupNavigation = createStaticNavigation(SetupStack);
const LoginNavigation = createStaticNavigation(LoginStack);

type RootStackParamList = StaticParamList<typeof SetupStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export default function App() {
  // Se chequea si ya existe la carpeta principal
  const [carpetaExiste, setCarpetaExiste] = useState<boolean | null>(null);

  useEffect(() => {
    async function comprobarCarpeta() {
      try {
        const guardada = await AsyncStorage.getItem(KEY_ROOT_URI);
        if (guardada) {
          //si la carpeta fue borrada esta linea tira error
          await FileSystem.StorageAccessFramework.readDirectoryAsync(guardada);
          setCarpetaExiste(true);
        } else {
          setCarpetaExiste(false);
        }
      } catch (error) {
        console.warn("La carpeta no es accessible", error);
        await AsyncStorage.removeItem(KEY_ROOT_URI);
        setCarpetaExiste(false);
      }
    }
    comprobarCarpeta();
  }, []);

  //Rueda de carga mientras se realiza la confirmacion
  if (carpetaExiste === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator/>
      </View>
    );
  }

  return (
  <>
  
  {carpetaExiste ? <LoginNavigation /> : <SetupNavigation />}

  <StatusBar style='auto'/>
  </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center'
  },
});
