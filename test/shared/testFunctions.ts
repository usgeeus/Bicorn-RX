import { assert, expect } from "chai"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import {
    BigNumberish,
    Contract,
    ContractTransactionReceipt,
    Log,
    BytesLike,
    toBeHex,
    dataLength,
} from "ethers"
import { network, ethers } from "hardhat"
import {
    VDFClaim,
    TestCase,
    BigNumber,
    SetUpParams,
    CommitParams,
    RevealParams,
    TestCaseJson,
} from "./interfaces"
import { testCases } from "./testcases"
import { developmentChains, networkConfig } from "../../helper-hardhat-config"
import fs from "fs"

export const getRankPointOfEachParticipants = async (
    commitRecoverContract: Contract,
    round: number,
): Promise<{ addresses: string[]; rankPoints: bigint[] }> => {
    let addresses: string[] = []
    let rankPoints: bigint[] = []
    let a: bigint = BigInt(
        ethers.keccak256(await commitRecoverContract.valuesAtRound(round).then((x) => x.omega.val)),
    )
    let valuesAtRound: any = await commitRecoverContract.valuesAtRound(round)
    for (let i = 0; i < valuesAtRound.numOfParticipants; i++) {
        let commitRevealValues: any = await commitRecoverContract.commitRevealValues(round, i)
        let address: string = commitRevealValues.participantAddress
        addresses.push(address)
        let b: bigint = BigInt(ethers.keccak256(address))
        let c: bigint = a - b
        rankPoints.push(c < 0n ? -c : c)
    }
    return { addresses, rankPoints }
}

export const getWinnerAddress = async (commitRecoverContract: Contract, round: number) => {
    let winnerIndex: number = 0
    let setUpValuesAtRound: any = await commitRecoverContract.setUpValuesAtRound(round)
    let valuesAtRound: any = await commitRecoverContract.valuesAtRound(round)
    let _n: bigint = setUpValuesAtRound.n.val
    let smallest = _n + 1n
    let _omega: bigint = valuesAtRound.omega.val
    let numOfParticipants: number = valuesAtRound.numOfParticipants

    for (let i = 0; i < numOfParticipants; i++) {
        let participantAddress: bigint = await commitRecoverContract
            .commitRevealValues(round, i)
            .then((x) => BigInt(x.participantAddress))
        let _value: bigint = BigInt(BigInt(participantAddress) % BigInt(_n)) - BigInt(_omega)
        _value = _value < 0n ? -_value : _value
        if (_value < smallest) {
            smallest = _value
            winnerIndex = i
        }
    }
    return await commitRecoverContract
        .commitRevealValues(round, winnerIndex)
        .then((x) => x.participantAddress)
}

export const createTestCases2 = () => {
    const result: TestCase[] = []
    const testData: TestCaseJson = JSON.parse(
        fs.readFileSync(__dirname + "/../shared/data_20231212_150019.json", "utf8"),
    )
    let ts: TestCase
    let setUpProofs: VDFClaim[] = []
    let recoveryProofs: VDFClaim[] = []
    let randomList: BigNumber[] = []
    let commitList: BigNumber[] = []
    for (let i = 0; i < (testData.setupProofs as []).length; i++) {
        setUpProofs.push({
            x: {
                //val: toBeHex(testcase[4][i][1]),
                val: toBeHex(
                    testData.setupProofs[i].x,
                    getLength(dataLength(toBeHex(testData.setupProofs[i].x))),
                ),
                bitlen: getBitLenth2(testData.setupProofs[i].x),
            },
            y: {
                //val: toBeHex(testcase[4][i][2]),
                val: toBeHex(
                    testData.setupProofs[i].y,
                    getLength(dataLength(toBeHex(testData.setupProofs[i].y))),
                ),
                bitlen: getBitLenth2(testData.setupProofs[i].y),
            },
            T: testData.setupProofs[i].T,
            v: {
                //val: toBeHex(testcase[4][i][4]),
                val: toBeHex(
                    testData.setupProofs[i].v,
                    getLength(dataLength(toBeHex(testData.setupProofs[i].v))),
                ),
                bitlen: getBitLenth2(testData.setupProofs[i].v),
            },
        })
    }
    for (let i = 0; i < (testData.recoveryProofs as []).length; i++) {
        recoveryProofs.push({
            x: {
                //val: toBeHex(testcase[9][i][1]),
                val: toBeHex(
                    testData.recoveryProofs[i].x,
                    getLength(dataLength(toBeHex(testData.recoveryProofs[i].x))),
                ),
                bitlen: getBitLenth2(testData.recoveryProofs[i].x),
            },
            y: {
                //val: toBeHex(testcase[9][i][2]),
                val: toBeHex(
                    testData.recoveryProofs[i].y,
                    getLength(dataLength(toBeHex(testData.recoveryProofs[i].y))),
                ),
                bitlen: getBitLenth2(testData.recoveryProofs[i].y),
            },
            T: testData.recoveryProofs[i].T,
            v: {
                //val: toBeHex(testcase[9][i][4]),
                val: toBeHex(
                    testData.recoveryProofs[i].v,
                    getLength(dataLength(toBeHex(testData.recoveryProofs[i].v))),
                ),
                bitlen: getBitLenth2(testData.recoveryProofs[i].v),
            },
        })
    }
    for (let i = 0; i < (testData.randomList as []).length; i++) {
        randomList.push({
            //val: toBeHex(testcase[5][i]),
            val: toBeHex(
                testData.randomList[i],
                getLength(dataLength(toBeHex(testData.randomList[i]))),
            ),
            bitlen: getBitLenth2(testData.randomList[i]),
        })
    }
    for (let i = 0; i < (testData.commitList as []).length; i++) {
        //commitList.push(testcase[6][i])
        commitList.push({
            //val: toBeHex(testcase[6][i]),
            val: toBeHex(
                testData.commitList[i],
                getLength(dataLength(toBeHex(testData.commitList[i]))),
            ),
            bitlen: getBitLenth2(testData.commitList[i]),
        })
    }
    result.push({
        //n: { val: toBeHex(testcase[0]), neg: false, bitlen: getBitLenth2(testcase[0]) },
        n: {
            val: toBeHex(testData.n, getLength(dataLength(toBeHex(testData.n)))),
            bitlen: getBitLenth2(testData.n),
        },
        //g: { val: toBeHex(testcase[1]), neg: false, bitlen: getBitLenth2(testcase[1]) },
        g: {
            val: toBeHex(testData.g, getLength(dataLength(toBeHex(testData.g)))),
            bitlen: getBitLenth2(testData.g),
        },
        //h: { val: toBeHex(testcase[2]), neg: false, bitlen: getBitLenth2(testcase[2]) },
        h: {
            val: toBeHex(testData.h, getLength(dataLength(toBeHex(testData.h)))),
            bitlen: getBitLenth2(testData.h),
        },
        T: BigInt(testData.T),
        setupProofs: setUpProofs,
        randomList: randomList,
        commitList: commitList,
        //omega: { val: toBeHex(testcase[7]), neg: false, bitlen: getBitLenth2(testcase[7]) },
        omega: {
            val: toBeHex(testData.omega, getLength(dataLength(toBeHex(testData.omega)))),
            bitlen: getBitLenth2(testData.omega),
        },
        recoveredOmega: {
            //val: toBeHex(testcase[8]),
            val: toBeHex(
                testData.recoveredOmega,
                getLength(dataLength(toBeHex(testData.recoveredOmega))),
            ),
            bitlen: getBitLenth2(testData.recoveredOmega),
        },
        recoveryProofs: recoveryProofs,
    })

    return result
}

const getBitLenth2 = (num: BigNumberish): BigNumberish => {
    return BigInt(num).toString(2).length
}

const getBitLenth = (num: bigint): BigNumberish => {
    return num.toString(2).length
}

function getLength(value: number): number {
    let length: number = 32
    while (length < value) length += 32
    return length
}
export const createTestCases = (testcases: any[]) => {
    const result: TestCase[] = []
    testcases.forEach((testcase) => {
        let ts: TestCase
        let setUpProofs: VDFClaim[] = []
        let recoveryProofs: VDFClaim[] = []
        let randomList: BigNumber[] = []
        let commitList: BigNumber[] = []
        for (let i = 0; i < (testcase[4] as []).length; i++) {
            setUpProofs.push({
                x: {
                    //val: toBeHex(testcase[4][i][1]),
                    val: toBeHex(
                        testcase[4][i][1],
                        getLength(dataLength(toBeHex(testcase[4][i][1]))),
                    ),
                    bitlen: getBitLenth(testcase[4][i][1]),
                },
                y: {
                    //val: toBeHex(testcase[4][i][2]),
                    val: toBeHex(
                        testcase[4][i][2],
                        getLength(dataLength(toBeHex(testcase[4][i][2]))),
                    ),
                    bitlen: getBitLenth(testcase[4][i][2]),
                },
                T: testcase[4][i][3],
                v: {
                    //val: toBeHex(testcase[4][i][4]),
                    val: toBeHex(
                        testcase[4][i][4],
                        getLength(dataLength(toBeHex(testcase[4][i][4]))),
                    ),
                    bitlen: getBitLenth(testcase[4][i][4]),
                },
            })
        }
        for (let i = 0; i < (testcase[9] as []).length; i++) {
            recoveryProofs.push({
                x: {
                    //val: toBeHex(testcase[9][i][1]),
                    val: toBeHex(
                        testcase[9][i][1],
                        getLength(dataLength(toBeHex(testcase[9][i][1]))),
                    ),
                    bitlen: getBitLenth(testcase[9][i][1]),
                },
                y: {
                    //val: toBeHex(testcase[9][i][2]),
                    val: toBeHex(
                        testcase[9][i][2],
                        getLength(dataLength(toBeHex(testcase[9][i][2]))),
                    ),
                    bitlen: getBitLenth(testcase[9][i][2]),
                },
                T: testcase[9][i][3],
                v: {
                    //val: toBeHex(testcase[9][i][4]),
                    val: toBeHex(
                        testcase[9][i][4],
                        getLength(dataLength(toBeHex(testcase[9][i][4]))),
                    ),
                    bitlen: getBitLenth(testcase[9][i][4]),
                },
            })
        }
        for (let i = 0; i < (testcase[5] as []).length; i++) {
            randomList.push({
                //val: toBeHex(testcase[5][i]),
                val: toBeHex(testcase[5][i], getLength(dataLength(toBeHex(testcase[5][i])))),
                bitlen: getBitLenth(testcase[5][i]),
            })
        }
        for (let i = 0; i < (testcase[6] as []).length; i++) {
            //commitList.push(testcase[6][i])
            commitList.push({
                //val: toBeHex(testcase[6][i]),
                val: toBeHex(testcase[6][i], getLength(dataLength(toBeHex(testcase[6][i])))),
                bitlen: getBitLenth(testcase[6][i]),
            })
        }
        result.push({
            //n: { val: toBeHex(testcase[0]), neg: false, bitlen: getBitLenth(testcase[0]) },
            n: {
                val: toBeHex(testcase[0], getLength(dataLength(toBeHex(testcase[0])))),
                bitlen: getBitLenth(testcase[0]),
            },
            //g: { val: toBeHex(testcase[1]), neg: false, bitlen: getBitLenth(testcase[1]) },
            g: {
                val: toBeHex(testcase[1], getLength(dataLength(toBeHex(testcase[1])))),
                bitlen: getBitLenth(testcase[1]),
            },
            //h: { val: toBeHex(testcase[2]), neg: false, bitlen: getBitLenth(testcase[2]) },
            h: {
                val: toBeHex(testcase[2], getLength(dataLength(toBeHex(testcase[2])))),
                bitlen: getBitLenth(testcase[2]),
            },
            T: testcase[3],
            setupProofs: setUpProofs,
            randomList: randomList,
            commitList: commitList,
            //omega: { val: toBeHex(testcase[7]), neg: false, bitlen: getBitLenth(testcase[7]) },
            omega: {
                val: toBeHex(testcase[7], getLength(dataLength(toBeHex(testcase[7])))),
                bitlen: getBitLenth(testcase[7]),
            },
            recoveredOmega: {
                //val: toBeHex(testcase[8]),
                val: toBeHex(testcase[8], getLength(dataLength(toBeHex(testcase[8])))),
                bitlen: getBitLenth(testcase[8]),
            },
            recoveryProofs: recoveryProofs,
        })
    })
    return result
}
export const deployCommitRecover = async () => {
    let commitRecoverContract = await ethers.deployContract("CommitRecover")
    commitRecoverContract = await commitRecoverContract.waitForDeployment()
    let tx = commitRecoverContract.deploymentTransaction()
    let receipt = await tx?.wait()
    return { commitRecoverContract, receipt }
}

export const setUpCommitRecoverRound = async (
    commitRecoverContract: Contract,
    params: SetUpParams,
) => {
    const setUpTx = await commitRecoverContract.setUp(
        params.commitDuration,
        params.commitRevealDuration,
        params.n,
        params.setupProofs,
    )
    const receipt = await setUpTx.wait()
    return { commitRecoverContract, receipt }
}

export const commit = async (
    commitRecoverContract: Contract,
    signer: SignerWithAddress,
    params: CommitParams,
) => {
    const tx = await (commitRecoverContract.connect(signer) as Contract).commit(
        params.round,
        params.commit,
    )
    const receipt = await tx.wait()
    return { commitRecoverContract, receipt }
}

export const reveal = async (
    commitRecoverContract: Contract,
    signer: SignerWithAddress,
    params: RevealParams,
) => {
    const tx = await (commitRecoverContract.connect(signer) as Contract).reveal(
        params.round,
        params.reveal,
    )
    const receipt = await tx.wait()
    return { commitRecoverContract, receipt }
}

export const deployAndSetUpCommitRecoverContract = async (params: any) => {
    let commitRecover = await ethers.deployContract("CommitRecover", [])
    commitRecover = await commitRecover.waitForDeployment()
    const tx = commitRecover.deploymentTransaction()
    let receipt = await tx?.wait()
    console.log("deploy gas used: ", receipt?.gasUsed?.toString())
    const setUpTx = await commitRecover.setUp(...params)
    receipt = await setUpTx.wait()
    console.log("setUp gas used: ", receipt?.gasUsed?.toString())
    return { commitRecover, receipt }
}

export const deployFirstTestCaseCommitRecoverContract = async () => {
    const testcases = createTestCases(testCases)
    const testcaseNum = 0
    let params = [
        networkConfig[network.config.chainId!].commitDuration,
        networkConfig[network.config.chainId!].commitRevealDuration,
        testcases[testcaseNum].n,
        testcases[testcaseNum].setupProofs,
    ]
    const { commitRecover, receipt } = await deployAndSetUpCommitRecoverContract(params)
    //get states
    // const {
    //     stage,
    //     commitSetUpTime,
    //     commitDuration,
    //     commitRevealDuration,
    //     n,
    //     g,
    //     h,
    //     T,
    //     round,
    //     deployedEvent,
    //     deployedBlockNum,
    //     deployedTimestamp,
    // } = await getStatesAfterDeployment(commitRecover, receipt as ContractTransactionReceipt)
    //return states
    return {
        commitRecover,
        receipt,
        testcases,
        params,
        // stage,
        // commitSetUpTime,
        // commitDuration,
        // commitRevealDuration,
        // n,
        // g,
        // h,
        // T,
        // round,
        // deployedEvent,
        // deployedBlockNum,
        // deployedTimestamp,
    }
}

export const getStatesAfterDeployment = async (
    commitRecoverContract: Contract,
    receipt: ContractTransactionReceipt,
) => {
    // contract states
    const stage = await commitRecoverContract.stage()
    const commitSetUpTime = await commitRecoverContract.setUpTime()
    const commitDuration = await commitRecoverContract.commitDuration()
    const commitRevealDuration = await commitRecoverContract.commitRevealDuration()
    const round = await commitRecoverContract.round()
    //console.log("round", round)
    const valuesAtRound = await commitRecoverContract.valuesAtRound(round)
    const n = valuesAtRound.n
    const g = valuesAtRound.g
    const h = valuesAtRound.h
    const T = valuesAtRound.T

    // event
    const topic = commitRecoverContract.interface.getEvent("SetUp")
    const log = receipt.logs.find((x) => x.topics.indexOf(topic?.topicHash!) >= 0)
    const deployedEvent = commitRecoverContract.interface.parseLog({
        topics: log?.topics! as string[],
        data: log?.data!,
    })

    // others
    const deployedBlockNum = receipt.blockNumber
    const deployedBlock = await ethers.provider.getBlock(deployedBlockNum)
    const deployedTimestamp = deployedBlock?.timestamp

    return {
        stage,
        commitSetUpTime,
        commitDuration,
        commitRevealDuration,
        n,
        g,
        h,
        T,
        round,
        deployedEvent,
        deployedBlockNum,
        deployedTimestamp,
    }
}

export const initializedContractCorrectly = async (
    commitRecoverContract: Contract,
    receipt: ContractTransactionReceipt,
    testcase: TestCase,
) => {
    const {
        stage,
        commitSetUpTime,
        commitDuration,
        commitRevealDuration,
        n,
        g,
        h,
        T,
        round,
        deployedEvent,
        deployedBlockNum,
        deployedTimestamp,
    } = await getStatesAfterDeployment(commitRecoverContract, receipt)

    assert.equal(
        commitSetUpTime,
        deployedTimestamp,
        "commitSetUpTime should be equal to deployedTimestamp",
    )
    assert.equal(commitSetUpTime, deployedEvent!.args?.setUpTime)
    assert.equal(stage, 0, "stage should be 0")
    assert.equal(
        commitDuration,
        networkConfig[network.config.chainId!].commitDuration,
        "commitDuration should be equal to networkConfig",
    )
    assert.equal(
        commitDuration,
        deployedEvent!.args?.commitDuration,
        "commitDuration should be equal to deployedEvent",
    )
    assert.equal(commitRevealDuration, networkConfig[network.config.chainId!].commitRevealDuration)
    assert.equal(
        commitRevealDuration,
        deployedEvent!.args?.commitRevealDuration,
        "commitRevealDuration should be equal to deployedEvent",
    )
    assert.isAbove(
        commitRevealDuration,
        commitDuration,
        "commitRevealDuration should be greater than commitDuration",
    )
    // console.log(n);
    // console.log(deployedEvent!.args?.n);
    // assert.equal(n, deployedEvent!.args?.n, "n should be equal to deployedEvent")
    // assert.equal(n, testcase.n, "n should be equal to testcase")
    // assert.equal(g, deployedEvent!.args?.g, "g should be equal to deployedEvent")
    // assert.equal(g, testcase.g, "g should be equal to testcase")
    // assert.equal(T, deployedEvent!.args?.T, "T should be equal to deployedEvent")
    // assert.equal(T, testcase.T, "T should be equal to testcase")
    // assert.equal(h, deployedEvent!.args?.h, "h should be equal to deployedEvent")
    // assert.equal(h, testcase.h, "h should be equal to testcase")
    // assert.equal(round, 1, "round should be 1")
    // assert.equal(round, deployedEvent!.args?.round, "round should be equal to deployedEvent")
}

interface CommitRecoverValue {
    c: BigNumberish
    a: BigNumberish
    participantAddress: string
}
interface UserAtRound {
    index: BigNumberish
    committed: boolean
    revealed: boolean
}

export const getStatesAfterCommitOrReveal = async (
    commitRecoverContract: Contract,
    receipt: ContractTransactionReceipt,
    signer: SignerWithAddress,
    i: number,
) => {
    //contract states
    const count = await commitRecoverContract.count()
    const stage = await commitRecoverContract.stage()
    const commitsString = await commitRecoverContract.commitsString()
    const round = await commitRecoverContract.round()
    const valuesAtRound = await commitRecoverContract.valuesAtRound(round)
    const userInfosAtRound: UserAtRound = await commitRecoverContract.userInfosAtRound(
        signer.address,
        round,
    )
    const commitRecoverValue: CommitRecoverValue = await commitRecoverContract.commitRecoverValues(
        round,
        i,
    )
    return {
        count,
        stage,
        commitsString,
        round,
        valuesAtRound,
        userInfosAtRound,
        commitRecoverValue,
    }
}

export const revealCheck = async (
    commitRecoverContract: Contract,
    receipt: ContractTransactionReceipt,
    random: BigNumber,
    signer: SignerWithAddress,
    i: number,
    roundTest: number,
) => {
    const ii = ethers.toBigInt(i)
    //get states
    // const {
    //     count,
    //     stage,
    //     commitsString,
    //     round,
    //     valuesAtRound,
    //     userInfosAtRound,
    //     commitRecoverValue,
    // } = await getStatesAfterCommitOrReveal(commitRecoverContract, receipt, signer, i)
    //console.log("valuesAtRoundvaluesAtRound, ", valuesAtRound)
    //const { omega, bStar, numOfParticipants, isCompleted } = valuesAtRound
}

let commitsStringTest: string
export const commitCheck = async (
    commitRecoverContract: Contract,
    receipt: ContractTransactionReceipt,
    commit: BigNumber,
    signer: SignerWithAddress,
    i: number,
    roundTest: number,
) => {
    //if (i == 0) commitsStringTest = ""
    const ii = ethers.toBigInt(i)
    //get states
    // const {
    //     count,
    //     stage,
    //     commitsString,
    //     round,
    //     valuesAtRound,
    //     userInfosAtRound,
    //     commitRecoverValue,
    // } = await getStatesAfterCommitOrReveal(commitRecoverContract, receipt, signer, i)
    //assert.equal(ii + BigInt(1), count, "count should be equal to i")
    // assert.equal(stage, 0, "stage should be 0")
    // assert.equal(round, 1, "round should be 1")
    // // commitsStringTest += commit.toString()
    // // assert.equal(
    // //     commitsStringTest,
    // //     commitsString,
    // //     "commitsString should be equal to commitsStringTest",
    // // )
    // assert.equal(roundTest, round, "round should be equal to roundTest")
    // const { omega, bStar, numOfParticipants, isCompleted } = valuesAtRound
    // assert.equal(omega, 0, "omega should be 0")
    // assert.equal(bStar, 0, "bStar should be 0")
    // assert.equal(numOfParticipants, 0, "numOfParticipants should be 0")
    // assert.equal(isCompleted, false, "isCompleted should be false")
    // const { index, committed, revealed } = userInfosAtRound
    // //assert.equal(index, ii, "index should be equal to i")
    // assert.equal(committed, true, "committed should be true")
    // assert.equal(revealed, false, "revealed should be false")
    //     assert.equal(commitRecoverValue.c, commit, "commitRecoverValue.c should be equal to commit")
    //     assert.equal(commitRecoverValue.participantAddress, signer.address)
    //     assert.equal(commitRecoverValue.a, 0, "commitRecoverValue.a should be 0")
}
